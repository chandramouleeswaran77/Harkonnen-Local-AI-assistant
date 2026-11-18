import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db.js';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const workspaces = db
    .prepare(`
      SELECT w.*,
        (SELECT COUNT(*) FROM chats c WHERE c.workspace_id = w.id AND c.archived = 0) as chat_count,
        (SELECT COUNT(*) FROM documents d WHERE d.workspace_id = w.id) as document_count,
        (SELECT COUNT(*) FROM memories m WHERE m.workspace_id = w.id) as memory_count
      FROM workspaces w
      ORDER BY w.is_default DESC, w.created_at ASC
    `)
    .all();
  res.json({ workspaces });
});

router.post('/', (req, res) => {
  const db = getDb();
  const {
    name,
    description = '',
    systemInstructions = '',
    icon = 'layers',
    accent = '#D4B483',
    defaultPersonality = 'general',
  } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Workspace name is required.' } });
  }

  const id = `ws-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO workspaces (id, name, description, system_instructions, icon, accent, default_personality)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), description.trim(), systemInstructions.trim(), icon, accent, defaultPersonality);

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  res.status(201).json({ workspace });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
  }

  const { name, description, systemInstructions, icon, accent, defaultPersonality } = req.body || {};
  db.prepare(`
    UPDATE workspaces
    SET name = ?, description = ?, system_instructions = ?, icon = ?, accent = ?, default_personality = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name !== undefined ? String(name).trim() || existing.name : existing.name,
    description !== undefined ? String(description) : existing.description,
    systemInstructions !== undefined ? String(systemInstructions) : existing.system_instructions,
    icon !== undefined ? icon : existing.icon,
    accent !== undefined ? accent : existing.accent,
    defaultPersonality !== undefined ? defaultPersonality : existing.default_personality,
    req.params.id
  );

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  res.json({ workspace });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
  }
  if (existing.is_default) {
    return res.status(400).json({ error: { code: 'CANNOT_DELETE_DEFAULT', message: 'Cannot delete the default workspace.' } });
  }
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: req.params.id });
});

export default router;
