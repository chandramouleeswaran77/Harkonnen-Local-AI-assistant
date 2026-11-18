import React, { useState } from 'react';
import { Layers, Plus, Trash2, Edit3, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { PERSONALITIES } from '../../data/personalities';
import { Modal } from '../Common/Modal';
import '../Models/Models.css';

const ACCENTS = ['#D4B483', '#8EA8C3', '#A3B899', '#C49BBB', '#D48C70', '#8EC3B9'];

export function WorkspaceModal() {
  const {
    activeModal,
    setActiveModal,
    workspaces,
    refreshWorkspaces,
    activeWorkspaceId,
    switchWorkspace,
    addToast,
  } = useApp();

  const isOpen = activeModal === 'workspaces';
  const [editing, setEditing] = useState(null); // null or workspace object or 'new'
  const [form, setForm] = useState({
    name: '',
    description: '',
    systemInstructions: '',
    accent: '#D4B483',
    defaultPersonality: 'general',
  });

  const openCreate = () => {
    setForm({
      name: '',
      description: '',
      systemInstructions: '',
      accent: '#D4B483',
      defaultPersonality: 'general',
    });
    setEditing('new');
  };

  const openEdit = (ws) => {
    setForm({
      name: ws.name,
      description: ws.description || '',
      systemInstructions: ws.system_instructions || '',
      accent: ws.accent || '#D4B483',
      defaultPersonality: ws.default_personality || 'general',
    });
    setEditing(ws);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editing === 'new') {
        const res = await api.createWorkspace(form);
        refreshWorkspaces();
        if (res.workspace?.id) switchWorkspace(res.workspace.id);
        addToast(`Created workspace "${form.name.trim()}"`, 'success');
      } else {
        await api.updateWorkspace(editing.id, form);
        refreshWorkspaces();
        addToast(`Updated workspace "${form.name.trim()}"`, 'success');
      }
      setEditing(null);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (ws) => {
    try {
      await api.deleteWorkspace(ws.id);
      if (activeWorkspaceId === ws.id) switchWorkspace('ws-personal');
      refreshWorkspaces();
      addToast(`Deleted workspace "${ws.name}"`, 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        setEditing(null);
        setActiveModal(null);
      }}
      title="Projects & Workspaces"
      subtitle="Isolate conversation history, custom instructions, documents, and local memory per project."
      size="wide"
      headerRight={
        !editing && (
          <button className="btn btn-accent" style={{ padding: '6px 12px', fontSize: 12 }} onClick={openCreate}>
            <Plus size={14} />
            New Workspace
          </button>
        )
      }
    >
      {editing ? (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Workspace Name
            </label>
            <input
              className="input"
              placeholder="e.g. Quantum Research, Startup Launch, Rust Compiler"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Description
            </label>
            <input
              className="input"
              placeholder="Short summary of this workspace's focus..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Default Personality
              </label>
              <select
                className="select"
                value={form.defaultPersonality}
                onChange={(e) => setForm({ ...form, defaultPersonality: e.target.value })}
              >
                {PERSONALITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Marker Color
              </label>
              <div style={{ display: 'flex', gap: 7, paddingTop: 6 }}>
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, accent: c })}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: c,
                      boxShadow: form.accent === c ? '0 0 0 2px var(--bg-surface), 0 0 0 4px var(--text-primary)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Custom Workspace System Instructions
            </label>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Instructions automatically applied to every conversation in this workspace..."
              value={form.systemInstructions}
              onChange={(e) => setForm({ ...form, systemInstructions: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={!form.name.trim()}>
              {editing === 'new' ? 'Create Workspace' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="model-list">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div key={ws.id} className={`model-card ${isActive ? 'active' : ''}`}>
                <div className="model-card-top">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    <div className="model-name-row">
                      <span className="workspace-dot" style={{ background: ws.accent, width: 9, height: 9 }} />
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{ws.name}</span>
                      {isActive && <span className="badge badge-accent">Active</span>}
                      <span className="badge">{ws.default_personality}</span>
                    </div>
                    {ws.description && (
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{ws.description}</p>
                    )}
                    <div className="model-meta-chips">
                      <span>{ws.chat_count ?? 0} chats</span>
                      <span>· {ws.document_count ?? 0} docs</span>
                      <span>· {ws.memory_count ?? 0} memories</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!isActive && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => {
                          switchWorkspace(ws.id);
                          setActiveModal(null);
                        }}
                      >
                        <Check size={13} /> Open
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => openEdit(ws)} title="Edit workspace">
                      <Edit3 size={14} />
                    </button>
                    {!ws.is_default && (
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--status-danger)' }}
                        onClick={() => handleDelete(ws)}
                        title="Delete workspace"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
