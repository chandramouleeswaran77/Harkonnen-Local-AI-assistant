import React, { useState } from 'react';
import { BookMarked, Plus, Trash2, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../Common/Modal';
import '../Models/Models.css';

export function PromptsModal() {
  const {
    activeModal,
    setActiveModal,
    prompts,
    refreshPrompts,
    setComposerDraft,
    addToast,
  } = useApp();

  const isOpen = activeModal === 'prompts';
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', content: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      await api.createPrompt(form);
      setForm({ title: '', description: '', category: 'General', content: '' });
      setCreating(false);
      refreshPrompts();
      addToast('Prompt saved to library', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deletePrompt(id);
      refreshPrompts();
      addToast('Prompt removed', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUsePrompt = (p) => {
    setComposerDraft((prev) => (prev ? `${prev}\n${p.content}` : p.content));
    setActiveModal(null);
    addToast(`Inserted "${p.title}"`, 'info', 2000);
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        setCreating(false);
        setActiveModal(null);
      }}
      title="Prompt Library"
      subtitle="Save and reuse high-leverage prompt templates locally."
      size="wide"
      headerRight={
        !creating && (
          <button className="btn btn-accent" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setCreating(true)}>
            <Plus size={14} /> New Prompt
          </button>
        )
      }
    >
      {creating ? (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              placeholder="Prompt title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <input
              className="input"
              style={{ maxWidth: 160 }}
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <input
            className="input"
            placeholder="Short description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            className="textarea"
            rows={5}
            placeholder="Prompt template content..."
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={!form.title.trim() || !form.content.trim()}>
              Save Prompt
            </button>
          </div>
        </form>
      ) : prompts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <BookMarked size={20} />
          </div>
          <h4>No prompts saved yet</h4>
          <p>Create reusable prompt templates for code reviews, synthesis, writing, or research.</p>
        </div>
      ) : (
        <div className="model-list">
          {prompts.map((p) => (
            <div key={p.id} className="entity-card">
              <div className="entity-card-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.title}</span>
                    <span className="badge">{p.category}</span>
                  </div>
                  {p.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{p.description}</p>
                  )}
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.content}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={() => handleUsePrompt(p)}
                  >
                    <ArrowUpRight size={13} />
                    Insert
                  </button>
                  <button
                    className="btn-icon"
                    style={{ color: 'var(--status-danger)' }}
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
