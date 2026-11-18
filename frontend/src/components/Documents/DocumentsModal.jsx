import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Search,
  Paperclip,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../Common/Modal';
import '../Models/Models.css';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentsModal() {
  const {
    activeModal,
    setActiveModal,
    workspaceDocs,
    refreshDocuments,
    activeWorkspaceId,
    attachedDocs,
    setAttachedDocs,
    addToast,
  } = useApp();

  const isOpen = activeModal === 'documents';
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [collectionName, setCollectionName] = useState('General');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const res = await api.uploadFile(file, {
          workspaceId: activeWorkspaceId,
          collectionName: collectionName.trim() || 'General',
        });
        addToast(
          `Indexed "${res.file.original_name}" (${res.file.chunk_count} chunks via ${res.file.embedding_model})`,
          'success'
        );
      }
      refreshDocuments();
    } catch (err) {
      addToast(err.message || 'Document upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    try {
      await api.deleteFile(doc.id);
      setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id));
      refreshDocuments();
      addToast(`Removed "${doc.original_name}"`, 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleLocalSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchFiles({
        query: searchQuery.trim(),
        workspaceId: activeWorkspaceId,
      });
      setSearchResults(res.results || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSearching(false);
    }
  };

  const attachToComposer = (doc) => {
    if (!attachedDocs.some((d) => d.id === doc.id)) {
      setAttachedDocs((prev) => [...prev, doc]);
      addToast(`Attached "${doc.original_name}" to next message`, 'success');
    }
    setActiveModal(null);
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => setActiveModal(null)}
      title="Local Document Intelligence"
      subtitle="Upload PDF, DOCX, TXT, Markdown, or CSV files for 100% local chunking, embeddings, and RAG citations."
      size="wide"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Upload Zone */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 230 }}
            placeholder="Collection name (e.g. Research)"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
          />
          <span className="badge badge-success">
            <ShieldCheck size={12} /> Processed 100% Locally — Never Leaves Your Machine
          </span>
        </div>

        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <Loader2 size={22} className="spin" style={{ color: 'var(--accent)' }} />
          ) : (
            <Upload size={22} style={{ color: 'var(--accent)' }} />
          )}
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>
            {uploading ? 'Extracting & indexing locally...' : 'Drop documents here or click to browse'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Supports PDF, DOCX, TXT, MD, CSV (up to 25 MB)
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Local RAG Search Tester */}
        {workspaceDocs.length > 0 && (
          <form onSubmit={handleLocalSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Test local RAG search across your indexed documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
              <span>Search</span>
            </button>
          </form>
        )}

        {searchResults && (
          <div className="entity-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 12.5 }}>
                Top Local Matches ({searchResults.length})
              </strong>
              <button
                className="btn btn-ghost"
                style={{ padding: '3px 8px', fontSize: 11.5 }}
                onClick={() => setSearchResults(null)}
              >
                Clear
              </button>
            </div>
            {searchResults.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No matching excerpts found.</div>
            ) : (
              searchResults.map((r) => (
                <div
                  key={r.chunkId}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: 'var(--accent)', fontWeight: 500, marginBottom: 4 }}>
                    {r.documentName} · Section {r.chunkIndex + 1} (score: {r.score})
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {r.content.slice(0, 260)}...
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Indexed Documents List */}
        {workspaceDocs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText size={20} />
            </div>
            <h4>No local documents indexed yet</h4>
            <p>
              Upload PDFs, notes, Markdown docs, or CSV files. HARKONNEN automatically retrieves relevant excerpts when you ask questions in this workspace.
            </p>
          </div>
        ) : (
          <div className="model-list">
            {workspaceDocs.map((doc) => (
              <div key={doc.id} className="entity-card">
                <div className="entity-card-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{doc.original_name}</span>
                      <span className="badge">{doc.collection_name}</span>
                      <span className="badge">{doc.embedding_model}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      {formatBytes(doc.size_bytes)} · {doc.chunk_count} chunks · {doc.char_count.toLocaleString()} chars
                    </div>
                    {doc.preview_text && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 2 }}>
                        {doc.preview_text}...
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => attachToComposer(doc)}
                      title="Explicitly attach to your next prompt"
                    >
                      <Paperclip size={13} />
                      Attach
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '6px 9px', fontSize: 12 }}
                      onClick={() => handleDelete(doc)}
                      title="Delete document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
