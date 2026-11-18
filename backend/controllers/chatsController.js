import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../database/db.js';
import { ollamaService } from '../services/ollamaService.js';
import { powerService } from '../services/powerService.js';

export function listChats(req, res) {
  const db = getDb();
  const { workspaceId, folderId, archived = '0', search = '' } = req.query;

  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.is_active_branch = 1) as message_count,
      (SELECT m.content FROM messages m WHERE m.chat_id = c.id AND m.is_active_branch = 1 ORDER BY m.created_at DESC LIMIT 1) as last_message
    FROM chats c
    WHERE c.archived = ?
  `;
  const params = [archived === '1' || archived === 'true' ? 1 : 0];

  if (workspaceId && workspaceId !== 'all') {
    sql += ' AND c.workspace_id = ?';
    params.push(workspaceId);
  }
  if (folderId) {
    sql += ' AND c.folder_id = ?';
    params.push(folderId);
  }
  if (search.trim()) {
    sql += ` AND (c.title LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.content LIKE ?))`;
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  sql += ' ORDER BY c.pinned DESC, c.updated_at DESC';
  const chats = db.prepare(sql).all(...params);
  res.json({ chats });
}

export function createChat(req, res) {
  const db = getDb();
  const {
    title = 'New Conversation',
    workspaceId = 'ws-personal',
    folderId = null,
    model = getSetting('active_model'),
    personality = 'general',
  } = req.body || {};

  const id = uuidv4();
  db.prepare(`
    INSERT INTO chats (id, title, workspace_id, folder_id, model, personality)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title.trim() || 'New Conversation', workspaceId, folderId || null, model, personality);

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  res.status(201).json({ chat });
}

export function getChat(req, res) {
  const db = getDb();
  const { id } = req.params;
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  if (!chat) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
  }

  const allMessages = db
    .prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC')
    .all(id)
    .map((m) => ({
      ...m,
      sources: safeJsonParse(m.sources_json, []),
      attachments: safeJsonParse(m.attachments_json, []),
      metadata: safeJsonParse(m.metadata_json, {}),
    }));

  // Compute branch counts for assistant siblings grouped by parent_id
  const siblingsByParent = new Map();
  for (const m of allMessages) {
    if (m.role === 'assistant' && m.parent_id) {
      if (!siblingsByParent.has(m.parent_id)) siblingsByParent.set(m.parent_id, []);
      siblingsByParent.get(m.parent_id).push(m);
    }
  }

  const activeMessages = allMessages
    .filter((m) => m.is_active_branch === 1)
    .map((m) => {
      const siblings = m.role === 'assistant' && m.parent_id ? siblingsByParent.get(m.parent_id) || [m] : [m];
      const currentPos = siblings.findIndex((s) => s.id === m.id);
      return {
        ...m,
        branchTotal: siblings.length,
        branchPosition: currentPos >= 0 ? currentPos : 0,
        siblingIds: siblings.map((s) => s.id),
      };
    });

  res.json({ chat, messages: activeMessages });
}

export function updateChat(req, res) {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
  }

  const { title, pinned, archived, folderId, workspaceId, model, personality, summary } = req.body || {};

  db.prepare(`
    UPDATE chats
    SET title = ?,
        pinned = ?,
        archived = ?,
        folder_id = ?,
        workspace_id = ?,
        model = ?,
        personality = ?,
        summary = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title !== undefined ? String(title).trim() || existing.title : existing.title,
    pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned,
    archived !== undefined ? (archived ? 1 : 0) : existing.archived,
    folderId !== undefined ? (folderId || null) : existing.folder_id,
    workspaceId !== undefined ? (workspaceId || null) : existing.workspace_id,
    model !== undefined ? model : existing.model,
    personality !== undefined ? personality : existing.personality,
    summary !== undefined ? summary : existing.summary,
    id
  );

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  res.json({ chat });
}

export function deleteChat(req, res) {
  const db = getDb();
  const { id } = req.params;
  const info = db.prepare('DELETE FROM chats WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
  }
  res.json({ deleted: true, id });
}

export function setMessageFeedback(req, res) {
  const db = getDb();
  const { messageId } = req.params;
  const { feedback } = req.body || {};
  if (feedback !== 'up' && feedback !== 'down' && feedback !== null) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Feedback must be "up", "down", or null.' } });
  }
  const info = db.prepare('UPDATE messages SET feedback = ? WHERE id = ?').run(feedback, messageId);
  if (info.changes === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Message not found.' } });
  }
  res.json({ updated: true, messageId, feedback });
}

export function switchMessageBranch(req, res) {
  const db = getDb();
  const { id: chatId, messageId } = req.params;
  const target = db.prepare('SELECT * FROM messages WHERE id = ? AND chat_id = ?').get(messageId, chatId);
  if (!target || !target.parent_id) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Branch message not found.' } });
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE messages SET is_active_branch = 0 WHERE chat_id = ? AND parent_id = ? AND role = \'assistant\'').run(
      chatId,
      target.parent_id
    );
    db.prepare('UPDATE messages SET is_active_branch = 1 WHERE id = ?').run(messageId);
  });
  tx();

  return getChat(req, res);
}

export function exportChatMarkdown(req, res) {
  const db = getDb();
  const { id } = req.params;
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  if (!chat) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
  }
  const messages = db
    .prepare('SELECT * FROM messages WHERE chat_id = ? AND is_active_branch = 1 ORDER BY created_at ASC')
    .all(id);

  const lines = [
    `# ${chat.title}`,
    '',
    `- **Model:** \`${chat.model}\``,
    `- **Assistant Mode:** ${chat.personality}`,
    `- **Exported:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ];

  for (const m of messages) {
    const label = m.role === 'user' ? '### User' : `### HARKONNEN (\`${m.model || chat.model}\`)`;
    lines.push(label, '', m.content, '', '---', '');
  }

  const md = lines.join('\n');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${slugify(chat.title)}.md"`);
  res.send(md);
}

export async function summarizeChat(req, res) {
  const db = getDb();
  const { id } = req.params;
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  if (!chat) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
  }
  const messages = db
    .prepare('SELECT role, content FROM messages WHERE chat_id = ? AND is_active_branch = 1 ORDER BY created_at ASC')
    .all(id);

  if (messages.length === 0) {
    return res.status(400).json({ error: { code: 'EMPTY_CHAT', message: 'No messages to summarize.' } });
  }

  const health = await ollamaService.checkHealth();
  if (!health.online) {
    return res.status(503).json({ error: { code: 'OLLAMA_OFFLINE', message: 'Ollama is offline.' } });
  }

  const transcript = messages
    .slice(-16)
    .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 600)}`)
    .join('\n\n');

  const { options, keep_alive } = powerService.buildInferenceOptions({ num_ctx: 2048 });
  let summary = '';
  const controller = new AbortController();

  await ollamaService.streamChat({
    model: chat.model || getSetting('active_model'),
    messages: [
      {
        role: 'system',
        content: 'Summarize this conversation concisely in 2-3 clear sentences capturing the main goal and conclusions.',
      },
      { role: 'user', content: transcript },
    ],
    options,
    keep_alive,
    signal: controller.signal,
    onChunk({ content }) {
      if (content) summary += content;
    },
  });

  const cleanSummary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  db.prepare('UPDATE chats SET summary = ?, updated_at = datetime(\'now\') WHERE id = ?').run(cleanSummary, id);
  res.json({ summary: cleanSummary });
}

// Folder CRUD helpers
export function listFolders(req, res) {
  const db = getDb();
  const { workspaceId } = req.query;
  const rows = workspaceId
    ? db.prepare('SELECT * FROM folders WHERE workspace_id = ? OR workspace_id IS NULL ORDER BY name ASC').all(workspaceId)
    : db.prepare('SELECT * FROM folders ORDER BY name ASC').all();
  res.json({ folders: rows });
}

export function createFolder(req, res) {
  const db = getDb();
  const { name, workspaceId = null, color = '#D4B483' } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Folder name is required.' } });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO folders (id, workspace_id, name, color) VALUES (?, ?, ?, ?)').run(
    id,
    workspaceId || null,
    name.trim(),
    color
  );
  res.status(201).json({ folder: db.prepare('SELECT * FROM folders WHERE id = ?').get(id) });
}

export function deleteFolder(req, res) {
  const db = getDb();
  const { id } = req.params;
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  res.json({ deleted: true, id });
}

function safeJsonParse(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

function slugify(str) {
  return (str || 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'conversation';
}
