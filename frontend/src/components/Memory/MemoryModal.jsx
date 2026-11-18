import React, { useState } from 'react';
import { Brain, Plus, Pin, Trash2, Edit3, Check, ShieldCheck, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../Common/Modal';
import '../Models/Models.css';

const CATEGORIES = ['preference', 'project', 'instruction', 'coding', 'general'];

export function MemoryModal() {
  const {
    activeModal,
    setActiveModal,
    memories,
    refreshMemories,
    activeWorkspaceId,
    settings,
    setSettingsTab,
    addToast,
  } = useApp();

  const isOpen = activeModal === 'memory';
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('preference');
  const [scopeGlobal, setScopeGlobal] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await api.createMemory({
        content: content.trim(),
        category,
        workspaceId: scopeGlobal ? null : activeWorkspaceId,
      });
      setContent('');
      refreshMemories();
      addToast('Memory saved locally', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleSaveEdit = async (id) => {
    if (!editText.trim()) return;
    try {
      await api.updateMemory(id, { content: editText.trim() });
      setEditingId(null);
      refreshMemories();
      addToast('Memory updated', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleTogglePin = async (mem) => {
    try {
      await api.updateMemory(mem.id, { pinned: !mem.pinned });
      refreshMemories();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteMemory(id);
      refreshMemories();
      addToast('Memory deleted', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const filtered = memories.filter(
    (m) =>
      !search.trim() ||
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      open={isOpen}
      onClose={() => setActiveModal(null)}
      title="Intelligent Local Memory"
      subtitle="Remember preferences, stack choices, and active projects privately in SQLite."
      size="wide"
      headerRight={
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: 12 }}
          onClick={() => {
            setSettingsTab('privacy');
            setActiveModal('settings');
          }}
        >
          <ShieldCheck size={13} />
          Auto-Memory: {settings.auto_memory_enabled ? 'On' : 'Off'}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Add Memory Form */}
        <form onSubmit={handleAdd} className="entity-card">
          <textarea
            className="textarea"
            rows={2}
            placeholder="Add a local memory (e.g. 'Prefer concise answers and clean React + Node.js examples')..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                className="select"
                style={{ width: 135, padding: '6px 9px' }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scopeGlobal}
                  onChange={(e) => setScopeGlobal(e.target.checked)}
                />
                Apply globally across all workspaces
              </label>
            </div>
            <button type="submit" className="btn btn-accent" disabled={!content.trim()}>
              <Plus size={14} />
              Save Memory
            </button>
          </div>
        </form>

        {/* Filter */}
        {memories.length > 0 && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, color: 'var(--text-tertiary)' }} />
            <input
              className="input"
              style={{ paddingLeft: 34 }}
              placeholder="Filter memories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Brain size={20} />
            </div>
            <h4>No local memories stored</h4>
            <p>
              Add preferences, ongoing projects, or coding conventions above. Sensitive data like passwords or keys is never saved automatically.
            </p>
          </div>
        ) : (
          <div className="model-list">
            {filtered.map((mem) => (
              <div key={mem.id} className="entity-card">
                <div className="entity-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className="badge badge-accent">{mem.category}</span>
                      <span className="badge">{mem.workspace_name || 'Global'}</span>
                      {mem.pinned ? <span className="badge badge-success">Always Active</span> : null}
                    </div>
                    {editingId === mem.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <button className="btn btn-accent" onClick={() => handleSaveEdit(mem.id)}>
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {mem.content}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon"
                      onClick={() => handleTogglePin(mem)}
                      title={mem.pinned ? 'Unpin memory' : 'Pin memory (always include)'}
                      style={{ color: mem.pinned ? 'var(--accent)' : undefined }}
                    >
                      <Pin size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => {
                        setEditingId(mem.id);
                        setEditText(mem.content);
                      }}
                      title="Edit memory"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(mem.id)}
                      title="Delete memory"
                      style={{ color: 'var(--status-danger)' }}
                    >
                      <Trash2 size={14} />
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
