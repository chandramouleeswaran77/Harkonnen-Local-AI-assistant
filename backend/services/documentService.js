import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import { getDb } from '../database/db.js';
import { ollamaService } from './ollamaService.js';
import { createLogger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const log = createLogger('documents');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.markdown', '.csv', '.json']);

function chunkText(text, chunkSize = 900, overlap = 160) {
  const cleaned = (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) return [];

  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);
    if (end < cleaned.length) {
      // Prefer breaking on paragraph or sentence boundaries
      const paraBreak = cleaned.lastIndexOf('\n\n', end);
      const sentBreak = cleaned.lastIndexOf('. ', end);
      if (paraBreak > start + chunkSize * 0.45) {
        end = paraBreak + 2;
      } else if (sentBreak > start + chunkSize * 0.45) {
        end = sentBreak + 2;
      }
    }
    const piece = cleaned.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function lexicalScore(queryTokens, chunkTextStr) {
  if (queryTokens.length === 0) return 0;
  const chunkTokens = tokenize(chunkTextStr);
  if (chunkTokens.length === 0) return 0;

  const freq = new Map();
  for (const t of chunkTokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  let score = 0;
  for (const qt of queryTokens) {
    const tf = freq.get(qt) || 0;
    if (tf > 0) {
      score += 1 + Math.log(1 + tf);
    }
  }
  return score / Math.sqrt(chunkTokens.length + 10);
}

async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    const err = new Error(`Unsupported file format "${ext}". Supported: PDF, DOCX, TXT, MD, CSV.`);
    err.statusCode = 400;
    throw err;
  }

  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  return buffer.toString('utf-8');
}

export const documentService = {
  async ingestFile(file, { workspaceId = null, collectionName = 'General' } = {}) {
    const rawText = await extractTextFromFile(file.path, file.originalname);
    const trimmed = rawText.trim();
    if (!trimmed) {
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      const err = new Error('Could not extract readable text from this file.');
      err.statusCode = 400;
      throw err;
    }

    const chunks = chunkText(trimmed);
    const docId = uuidv4();
    const preview = trimmed.slice(0, 280).replace(/\s+/g, ' ');

    // Attempt local Ollama embeddings ONLY if an embedding model is already installed
    let embeddingModel = 'lexical-tfidf';
    const chunkEmbeddings = [];
    if (chunks.length <= 60) {
      const probe = await ollamaService.tryGenerateEmbedding(chunks[0]);
      if (probe) {
        embeddingModel = probe.model;
        chunkEmbeddings.push(probe.vector);
        for (let i = 1; i < chunks.length; i++) {
          const emb = await ollamaService.tryGenerateEmbedding(chunks[i]);
          chunkEmbeddings.push(emb ? emb.vector : null);
        }
      }
    }

    const db = getDb();
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO documents
          (id, workspace_id, collection_name, filename, original_name, mime_type, size_bytes, char_count, chunk_count, embedding_model, preview_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        docId,
        workspaceId || null,
        collectionName || 'General',
        file.filename,
        file.originalname,
        file.mimetype || 'application/octet-stream',
        file.size,
        trimmed.length,
        chunks.length,
        embeddingModel,
        preview
      );

      const insertChunk = db.prepare(`
        INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding_json, tokens_est)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      chunks.forEach((content, idx) => {
        const vec = chunkEmbeddings[idx] || null;
        insertChunk.run(
          uuidv4(),
          docId,
          idx,
          content,
          vec ? JSON.stringify(vec) : null,
          Math.ceil(content.length / 4)
        );
      });
    });

    tx();
    log.info(`Ingested local document ${file.originalname}`, {
      docId,
      chunks: chunks.length,
      embeddingModel,
    });

    return db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  },

  list({ workspaceId = null, collectionName = null } = {}) {
    const db = getDb();
    let sql = `
      SELECT d.*, w.name as workspace_name
      FROM documents d
      LEFT JOIN workspaces w ON d.workspace_id = w.id
      WHERE 1=1
    `;
    const params = [];
    if (workspaceId) {
      sql += ' AND (d.workspace_id = ? OR d.workspace_id IS NULL)';
      params.push(workspaceId);
    }
    if (collectionName) {
      sql += ' AND d.collection_name = ?';
      params.push(collectionName);
    }
    sql += ' ORDER BY d.created_at DESC';
    return db.prepare(sql).all(...params);
  },

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  },

  remove(id, uploadDir) {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) return false;

    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    if (uploadDir && doc.filename) {
      const fullPath = path.join(uploadDir, doc.filename);
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch {
        // ignore cleanup error
      }
    }
    return true;
  },

  /**
   * Local RAG retrieval across specified documentIds or active workspace documents.
   * Uses cosine similarity on local embeddings when available, seamlessly combined with lexical scoring.
   */
  async retrieveRelevantChunks(query, { workspaceId = null, documentIds = [], topK = 4 } = {}) {
    const db = getDb();
    let rows = [];

    if (Array.isArray(documentIds) && documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(',');
      rows = db
        .prepare(`
          SELECT c.id, c.document_id, c.chunk_index, c.content, c.embedding_json, d.original_name, d.collection_name
          FROM document_chunks c
          JOIN documents d ON c.document_id = d.id
          WHERE c.document_id IN (${placeholders})
        `)
        .all(...documentIds);
    } else if (workspaceId) {
      rows = db
        .prepare(`
          SELECT c.id, c.document_id, c.chunk_index, c.content, c.embedding_json, d.original_name, d.collection_name
          FROM document_chunks c
          JOIN documents d ON c.document_id = d.id
          WHERE d.workspace_id = ? OR d.workspace_id IS NULL
        `)
        .all(workspaceId);
    } else {
      return [];
    }

    if (rows.length === 0) return [];

    const hasEmbeddings = rows.some((r) => Boolean(r.embedding_json));
    let queryEmbedding = null;
    if (hasEmbeddings) {
      const emb = await ollamaService.tryGenerateEmbedding(query);
      if (emb) queryEmbedding = emb.vector;
    }

    const queryTokens = tokenize(query);
    const scored = rows.map((row) => {
      let vectorScore = 0;
      if (queryEmbedding && row.embedding_json) {
        try {
          const vec = JSON.parse(row.embedding_json);
          vectorScore = cosineSimilarity(queryEmbedding, vec);
        } catch {
          vectorScore = 0;
        }
      }
      const lexScore = lexicalScore(queryTokens, row.content);
      // Combine vector + lexical relevance, or pure lexical when embeddings absent
      const finalScore = queryEmbedding ? vectorScore * 0.72 + Math.min(1, lexScore) * 0.28 : lexScore;

      return {
        chunkId: row.id,
        documentId: row.document_id,
        documentName: row.original_name,
        collectionName: row.collection_name,
        chunkIndex: row.chunk_index,
        content: row.content,
        score: Math.round(finalScore * 1000) / 1000,
      };
    });

    // If explicit documents were attached to the message, guarantee top chunks even if query is broad (e.g. "summarize this")
    const filtered =
      documentIds.length > 0
        ? scored
        : scored.filter((s) => s.score > 0.08);

    return filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },
};
