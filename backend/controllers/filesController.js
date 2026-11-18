import { CONFIG } from '../config.js';
import { documentService } from '../services/documentService.js';

export async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded.' } });
    }
    const workspaceId = req.body?.workspaceId || null;
    const collectionName = req.body?.collectionName || 'General';

    const doc = await documentService.ingestFile(req.file, { workspaceId, collectionName });
    res.status(201).json({ file: doc });
  } catch (err) {
    next(err);
  }
}

export function listFiles(req, res) {
  const { workspaceId = null, collectionName = null } = req.query;
  const files = documentService.list({ workspaceId, collectionName });
  res.json({ files });
}

export function deleteFile(req, res) {
  const { id } = req.params;
  const removed = documentService.remove(id, CONFIG.UPLOAD_DIR);
  if (!removed) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
  }
  res.json({ deleted: true, id });
}

export async function searchFiles(req, res, next) {
  try {
    const { query, workspaceId = null, documentIds = [] } = req.body || {};
    if (!query?.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Search query is required.' } });
    }
    const results = await documentService.retrieveRelevantChunks(query, {
      workspaceId,
      documentIds,
      topK: 6,
    });
    res.json({ results });
  } catch (err) {
    next(err);
  }
}
