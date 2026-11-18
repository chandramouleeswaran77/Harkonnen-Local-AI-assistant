import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../database/db.js';
import { containsSensitiveInfo, sanitizeForMemory } from '../utils/privacyFilter.js';

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in',
  'with', 'by', 'as', 'from', 'that', 'this', 'it', 'be', 'are', 'was', 'were', 'can',
  'you', 'i', 'me', 'my', 'we', 'our', 'please', 'help', 'about', 'what', 'how', 'why',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export const memoryService = {
  list({ workspaceId = null, search = '' } = {}) {
    const db = getDb();
    let sql = `
      SELECT m.*, w.name as workspace_name
      FROM memories m
      LEFT JOIN workspaces w ON m.workspace_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (workspaceId === 'global') {
      sql += ' AND m.workspace_id IS NULL';
    } else if (workspaceId) {
      sql += ' AND (m.workspace_id = ? OR m.workspace_id IS NULL)';
      params.push(workspaceId);
    }

    if (search.trim()) {
      sql += ' AND (m.content LIKE ? OR m.category LIKE ?)';
      const like = `%${search.trim()}%`;
      params.push(like, like);
    }

    sql += ' ORDER BY m.pinned DESC, m.updated_at DESC';
    return db.prepare(sql).all(...params);
  },

  create({ content, category = 'general', workspaceId = null, sourceChatId = null, pinned = false }) {
    const clean = sanitizeForMemory(content);
    if (!clean) {
      const err = new Error('Memory content cannot be empty.');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO memories (id, workspace_id, category, content, source_chat_id, pinned)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, workspaceId || null, category, clean, sourceChatId || null, pinned ? 1 : 0);

    return db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
  },

  update(id, { content, category, workspaceId, pinned }) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    if (!existing) {
      const err = new Error('Memory not found.');
      err.statusCode = 404;
      throw err;
    }

    const nextContent = content !== undefined ? sanitizeForMemory(content) : existing.content;
    const nextCategory = category !== undefined ? category : existing.category;
    const nextWorkspace = workspaceId !== undefined ? (workspaceId || null) : existing.workspace_id;
    const nextPinned = pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned;

    db.prepare(`
      UPDATE memories
      SET content = ?, category = ?, workspace_id = ?, pinned = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextContent, nextCategory, nextWorkspace, nextPinned, id);

    return db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
  },

  remove(id) {
    const db = getDb();
    const res = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return res.changes > 0;
  },

  /**
   * Retrieves the most relevant local memories (pinned + keyword overlap) for a prompt.
   */
  retrieveRelevant(query, { workspaceId = null, limit = 6 } = {}) {
    const all = this.list({ workspaceId });
    if (all.length === 0) return [];

    const queryTokens = new Set(tokenize(query));
    const scored = all.map((mem) => {
      const memTokens = tokenize(mem.content + ' ' + mem.category);
      let overlap = 0;
      for (const tok of memTokens) {
        if (queryTokens.has(tok)) overlap += 1;
      }
      const workspaceBoost = workspaceId && mem.workspace_id === workspaceId ? 1.5 : 0;
      const pinnedBoost = mem.pinned ? 3.0 : 0;
      const score = overlap + workspaceBoost + pinnedBoost;
      return { mem, score };
    });

    return scored
      .filter((s) => s.score > 0 || s.mem.pinned)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.mem);
  },

  /**
   * Lightweight, purely local pattern-based extraction of explicit user preferences
   * ONLY when auto_memory_enabled is explicitly turned on. Never saves sensitive data.
   */
  maybeExtractFromMessage(userMessage, { workspaceId = null, chatId = null } = {}) {
    if (!getSetting('auto_memory_enabled', false)) return null;
    if (!userMessage || userMessage.length > 1500) return null;
    if (containsSensitiveInfo(userMessage)) return null;

    const patterns = [
      { regex: /\b(?:remember that|note that|always remember)\s+(.{8,220})/i, category: 'instruction' },
      { regex: /\b(?:i prefer|i usually use|my favorite programming language is|my preferred stack is)\s+(.{4,180})/i, category: 'preference' },
      { regex: /\b(?:i am working on|my current project is|i'm building)\s+(.{6,200})/i, category: 'project' },
    ];

    for (const p of patterns) {
      const match = userMessage.match(p.regex);
      if (match && match[0]) {
        const candidate = sanitizeForMemory(match[0].replace(/[.!?]+$/, ''));
        if (containsSensitiveInfo(candidate)) return null;

        // Deduplicate against existing memories
        const existing = this.list({ workspaceId });
        const duplicate = existing.some(
          (m) => m.content.toLowerCase() === candidate.toLowerCase()
        );
        if (duplicate) return null;

        return this.create({
          content: candidate,
          category: p.category,
          workspaceId,
          sourceChatId: chatId,
          pinned: false,
        });
      }
    }
    return null;
  },
};
