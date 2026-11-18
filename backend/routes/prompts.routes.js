import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db.js';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const prompts = db.prepare('SELECT * FROM prompts ORDER BY category ASC, title ASC').all();
  res.json({ prompts });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { title, description = '', content, category = 'General' } = req.body || {};
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Prompt title and content are required.' },
    });
  }
  const id = `pr-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO prompts (id, title, description, content, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title.trim(), description.trim(), content, category.trim() || 'General');
  res.status(201).json({ prompt: db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prompt not found.' } });
  }
  const { title, description, content, category } = req.body || {};
  db.prepare(`
    UPDATE prompts
    SET title = ?, description = ?, content = ?, category = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title !== undefined ? String(title).trim() || existing.title : existing.title,
    description !== undefined ? String(description) : existing.description,
    content !== undefined ? String(content) : existing.content,
    category !== undefined ? String(category) : existing.category,
    req.params.id
  );
  res.json({ prompt: db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM prompts WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prompt not found.' } });
  }
  res.json({ deleted: true, id: req.params.id });
});

export default router;
