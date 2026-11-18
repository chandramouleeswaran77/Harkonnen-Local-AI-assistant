import { v4 as uuidv4 } from 'uuid';
import { getDb, getAllSettings } from '../database/db.js';
import { ollamaService } from '../services/ollamaService.js';
import { powerService } from '../services/powerService.js';
import { memoryService } from '../services/memoryService.js';
import { documentService } from '../services/documentService.js';
import { webSearchService } from '../services/webSearchService.js';
import { analyticsService } from '../services/analyticsService.js';
import { getPersonalityPrompt } from '../services/personalities.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('chat');

function sendSSE(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function generateSmartTitle(message) {
  const cleaned = (message || '')
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'New Conversation';
  const words = cleaned.split(' ').slice(0, 8).join(' ');
  const trimmed = words.length > 56 ? words.slice(0, 56).trim() + '...' : words;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Extracts inline <think>...</think> blocks cleanly if a model outputs them inside content.
 */
function splitThinkTags(fullContent, existingThinking = '') {
  let thinking = existingThinking || '';
  let content = fullContent || '';
  const regex = /<think>([\s\S]*?)<\/think>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]?.trim()) {
      thinking = thinking ? `${thinking}\n\n${match[1].trim()}` : match[1].trim();
    }
  }
  content = content.replace(regex, '').trim();
  return { content, thinking };
}

export async function handleStreamChat(req, res) {
  const {
    chatId,
    message,
    model: requestedModel,
    personality = 'general',
    workspaceId = null,
    documentIds = [],
    useWorkspaceDocs = true,
    useWebSearch = false,
    temporary = false,
    history = [],
    parentMessageId = null,
    editMessageId = null,
    regenerateFromUserMessageId = null,
    options: inferenceOverrides = {},
  } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message is required.' } });
  }

  const settings = getAllSettings();
  const targetModel = requestedModel || settings.active_model;
  const requestId = uuidv4();
  const abortController = new AbortController();

  // Enforce single-request concurrency limit to protect GPU/RAM
  try {
    powerService.acquireGenerationSlot(requestId, targetModel, abortController);
  } catch (err) {
    return res.status(err.statusCode || 429).json({
      error: { code: err.code || 'BUSY', message: err.message },
    });
  }

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  const db = getDb();
  let activeChatId = chatId || null;
  let userMessageId = regenerateFromUserMessageId || null;
  const assistantMessageId = uuidv4();

  try {
    sendSSE(res, 'meta', { requestId, model: targetModel, status: 'preparing' });

    // 1. Check Ollama connectivity early before mutating DB or starting inference
    const health = await ollamaService.checkHealth();
    if (!health.online) {
      throw Object.assign(
        new Error(
          `Ollama is offline (${health.error}). Start Ollama locally with "ollama serve" and ensure "${targetModel}" is installed.`
        ),
        { code: 'OLLAMA_OFFLINE' }
      );
    }

    // 2. Enforce single active model policy (unload other non-embed models first)
    await ollamaService.ensureSingleActiveModel(targetModel);

    // 3. Ensure persistent chat & user message (unless temporary mode)
    let activeWorkspaceId = workspaceId;
    if (!temporary) {
      if (!activeChatId) {
        activeChatId = uuidv4();
        const title = generateSmartTitle(message);
        db.prepare(`
          INSERT INTO chats (id, title, workspace_id, model, personality)
          VALUES (?, ?, ?, ?, ?)
        `).run(activeChatId, title, activeWorkspaceId || 'ws-personal', targetModel, personality);
        sendSSE(res, 'chat_created', { id: activeChatId, title });
      } else {
        const existingChat = db.prepare('SELECT * FROM chats WHERE id = ?').get(activeChatId);
        if (!existingChat) {
          const title = generateSmartTitle(message);
          db.prepare(`
            INSERT INTO chats (id, title, workspace_id, model, personality)
            VALUES (?, ?, ?, ?, ?)
          `).run(activeChatId, title, activeWorkspaceId || 'ws-personal', targetModel, personality);
        } else {
          activeWorkspaceId = activeWorkspaceId || existingChat.workspace_id;
          // Auto-title if still default
          if (existingChat.title === 'New Conversation') {
            const nextTitle = generateSmartTitle(message);
            db.prepare('UPDATE chats SET title = ?, model = ?, personality = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
              nextTitle,
              targetModel,
              personality,
              activeChatId
            );
            sendSSE(res, 'chat_updated', { id: activeChatId, title: nextTitle });
          } else {
            db.prepare('UPDATE chats SET model = ?, personality = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
              targetModel,
              personality,
              activeChatId
            );
          }
        }
      }

      // If editing an earlier user message, prune subsequent messages in that active branch
      if (editMessageId) {
        const edited = db.prepare('SELECT * FROM messages WHERE id = ? AND chat_id = ?').get(editMessageId, activeChatId);
        if (edited) {
          db.prepare('DELETE FROM messages WHERE chat_id = ? AND created_at > ?').run(activeChatId, edited.created_at);
          db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(message.trim(), editMessageId);
          userMessageId = editMessageId;
        }
      }

      // Insert new user message unless regenerating an existing one
      if (!userMessageId) {
        userMessageId = uuidv4();
        const attachmentMeta = Array.isArray(documentIds) && documentIds.length > 0
          ? documentIds.map((id) => documentService.getById(id)).filter(Boolean).map((d) => ({
              id: d.id,
              name: d.original_name,
              sizeBytes: d.size_bytes,
            }))
          : [];

        db.prepare(`
          INSERT INTO messages (id, chat_id, parent_id, role, content, model, attachments_json)
          VALUES (?, ?, ?, 'user', ?, ?, ?)
        `).run(userMessageId, activeChatId, parentMessageId || null, message.trim(), targetModel, JSON.stringify(attachmentMeta));
      }

      // Optional opt-in local memory extraction (guarded against sensitive data)
      const extractedMem = memoryService.maybeExtractFromMessage(message, {
        workspaceId: activeWorkspaceId,
        chatId: activeChatId,
      });
      if (extractedMem) {
        sendSSE(res, 'memory_saved', { memory: extractedMem });
      }
    }

    // 4. Assemble System Prompt: Personality + Workspace Instructions + User Custom Prompt + Memories + RAG + Optional Web Search
    const systemSections = [getPersonalityPrompt(personality)];

    if (settings.user_name) {
      systemSections.push(`The user's name is ${settings.user_name}.`);
    }

    if (activeWorkspaceId) {
      const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(activeWorkspaceId);
      if (ws?.system_instructions?.trim()) {
        systemSections.push(`Workspace ("${ws.name}") Instructions:\n${ws.system_instructions.trim()}`);
      }
    }

    if (settings.custom_system_prompt?.trim()) {
      systemSections.push(`Additional User Instructions:\n${settings.custom_system_prompt.trim()}`);
    }

    // Retrieve relevant local memories
    const relevantMemories = memoryService.retrieveRelevant(message, {
      workspaceId: activeWorkspaceId,
      limit: 6,
    });
    if (relevantMemories.length > 0) {
      const memLines = relevantMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n');
      systemSections.push(
        `Relevant Local Memories (stored privately by the user; apply naturally when helpful):\n${memLines}`
      );
    }

    const sources = [];

    // Local Document Intelligence (RAG)
    const shouldSearchDocs =
      (Array.isArray(documentIds) && documentIds.length > 0) ||
      (useWorkspaceDocs && Boolean(activeWorkspaceId));

    if (shouldSearchDocs) {
      const chunks = await documentService.retrieveRelevantChunks(message, {
        workspaceId: documentIds.length > 0 ? null : activeWorkspaceId,
        documentIds,
        topK: 4,
      });
      if (chunks.length > 0) {
        const docContext = chunks
          .map(
            (c, i) =>
              `[Local Doc ${i + 1}: "${c.documentName}" (section ${c.chunkIndex + 1})]\n${c.content}`
          )
          .join('\n\n');
        systemSections.push(
          `Retrieved Local Document Excerpts (processed 100% locally — cite document names when referencing them):\n${docContext}`
        );
        chunks.forEach((c) => {
          sources.push({
            type: 'document',
            documentId: c.documentId,
            title: c.documentName,
            section: c.chunkIndex + 1,
            snippet: c.content.slice(0, 220),
            score: c.score,
          });
        });
      }
    }

    // Optional Opt-In Web Search (disabled by default; strictly requires both setting + request flag)
    if (useWebSearch && webSearchService.isEnabled()) {
      sendSSE(res, 'status', { stage: 'searching_web', label: 'Retrieving opt-in web sources...' });
      const webResults = await webSearchService.search(message, { maxResults: 4 });
      if (webResults.length > 0) {
        const webContext = webResults
          .map((r, i) => `[Web Source ${i + 1}: ${r.title} (${r.url})]\n${r.snippet}`)
          .join('\n\n');
        systemSections.push(
          `Retrieved Web Information (external web search explicitly enabled by the user; clearly distinguish this from local model knowledge and cite URLs):\n${webContext}`
        );
        webResults.forEach((r) => sources.push(r));
      }
    }

    if (sources.length > 0) {
      sendSSE(res, 'sources', { sources });
    }

    // 5. Build conversation history for Ollama
    const ollamaMessages = [{ role: 'system', content: systemSections.join('\n\n') }];

    if (!temporary && activeChatId) {
      const dbMessages = db
        .prepare(`
          SELECT id, role, content FROM messages
          WHERE chat_id = ? AND is_active_branch = 1
          ORDER BY created_at ASC
        `)
        .all(activeChatId);

      // Keep recent window respecting context budget
      const recent = dbMessages.slice(-24);
      for (const m of recent) {
        ollamaMessages.push({ role: m.role, content: m.content });
      }
    } else {
      const recentHistory = Array.isArray(history) ? history.slice(-20) : [];
      for (const m of recentHistory) {
        if (m.role === 'user' || m.role === 'assistant') {
          ollamaMessages.push({ role: m.role, content: String(m.content || '') });
        }
      }
      ollamaMessages.push({ role: 'user', content: message.trim() });
    }

    // 6. Stream response from Ollama respecting power profile
    const { options, keep_alive, profile } = powerService.buildInferenceOptions(inferenceOverrides);
    sendSSE(res, 'meta', {
      requestId,
      chatId: activeChatId,
      userMessageId,
      assistantMessageId,
      model: targetModel,
      powerMode: profile.id,
      numCtx: options.num_ctx,
      status: 'generating',
    });

    let fullContent = '';
    let fullThinking = '';

    const stats = await ollamaService.streamChat({
      model: targetModel,
      messages: ollamaMessages,
      options,
      keep_alive,
      signal: abortController.signal,
      onChunk({ content, thinking }) {
        if (content) {
          fullContent += content;
          sendSSE(res, 'token', { content });
        }
        if (thinking) {
          fullThinking += thinking;
          sendSSE(res, 'thinking', { thinking });
        }
      },
    });

    const parsed = splitThinkTags(fullContent, fullThinking);

    // 7. Save assistant response & usage telemetry
    if (!temporary && activeChatId) {
      // If regenerating, mark previous sibling assistant messages on the same parent as non-active branch
      let branchIndex = 0;
      if (regenerateFromUserMessageId) {
        const siblings = db
          .prepare('SELECT id, branch_index FROM messages WHERE chat_id = ? AND parent_id = ? AND role = \'assistant\'')
          .all(activeChatId, regenerateFromUserMessageId);
        if (siblings.length > 0) {
          branchIndex = Math.max(...siblings.map((s) => s.branch_index)) + 1;
          db.prepare(
            'UPDATE messages SET is_active_branch = 0 WHERE chat_id = ? AND parent_id = ? AND role = \'assistant\''
          ).run(activeChatId, regenerateFromUserMessageId);
        }
      }

      db.prepare(`
        INSERT INTO messages (id, chat_id, parent_id, branch_index, is_active_branch, role, content, thinking, model, sources_json, metadata_json)
        VALUES (?, ?, ?, ?, 1, 'assistant', ?, ?, ?, ?, ?)
      `).run(
        assistantMessageId,
        activeChatId,
        userMessageId,
        branchIndex,
        parsed.content || fullContent,
        parsed.thinking,
        targetModel,
        JSON.stringify(sources),
        JSON.stringify(stats || {})
      );

      db.prepare('UPDATE chats SET updated_at = datetime(\'now\') WHERE id = ?').run(activeChatId);
    }

    if (stats) {
      analyticsService.recordUsage({
        model: targetModel,
        ...stats,
        powerMode: profile.id,
      });
    }

    sendSSE(res, 'done', {
      requestId,
      chatId: activeChatId,
      userMessageId,
      assistantMessageId,
      content: parsed.content || fullContent,
      thinking: parsed.thinking,
      sources,
      stats,
    });
  } catch (err) {
    if (err.name === 'AbortError' || clientClosed) {
      log.info(`Generation aborted (${requestId})`);
      sendSSE(res, 'aborted', { requestId, message: 'Generation stopped.' });
    } else {
      log.error(`Chat stream error: ${err.message}`);
      sendSSE(res, 'error', {
        code: err.code || 'STREAM_ERROR',
        message: err.message || 'Failed to generate response from local model.',
      });
    }
  } finally {
    powerService.releaseGenerationSlot(requestId);
    if (!res.writableEnded) res.end();
  }
}

export function handleStopGeneration(req, res) {
  const { requestId } = req.body || {};
  const stopped = requestId
    ? powerService.abortGeneration(requestId)
    : powerService.abortAllGenerations() > 0;
  res.json({ stopped });
}
