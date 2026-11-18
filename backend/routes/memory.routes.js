import { Router } from 'express';
import { memoryService } from '../services/memoryService.js';

const router = Router();

router.get('/', (req, res) => {
  const { workspaceId = null, search = '' } = req.query;
  const memories = memoryService.list({ workspaceId, search });
  res.json({ memories });
});

router.post('/', (req, res, next) => {
  try {
    const { content, category = 'general', workspaceId = null, sourceChatId = null, pinned = false } = req.body || {};
    const memory = memoryService.create({ content, category, workspaceId, sourceChatId, pinned });
    res.status(201).json({ memory });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const memory = memoryService.update(req.params.id, req.body || {});
    res.json({ memory });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res) => {
  const deleted = memoryService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Memory not found.' } });
  }
  res.json({ deleted: true, id: req.params.id });
});

export default router;
