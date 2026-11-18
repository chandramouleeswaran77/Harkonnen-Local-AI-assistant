import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  Square,
  Paperclip,
  Cpu,
  ChevronDown,
  Globe,
  BookMarked,
  FileText,
  X,
  Check,
  Sparkles,
  Mic,
  MicOff,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { PERSONALITIES } from '../../data/personalities';

export function Composer() {
  const {
    settings,
    modelsData,
    switchActiveModel,
    personality,
    setPersonality,
    useWebSearch,
    setUseWebSearch,
    attachedDocs,
    setAttachedDocs,
    activeWorkspaceId,
    refreshDocuments,
    prompts,
    composerDraft,
    setComposerDraft,
    isGenerating,
    streamStatus,
    sendMessage,
    stopGeneration,
    setActiveModal,
    setSettingsTab,
    addToast,
  } = useApp();

  const [openMenu, setOpenMenu] = useState(null); // null | 'model' | 'personality' | 'prompts'
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const toolbarRef = useRef(null);
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Auto-resize textarea cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [composerDraft]);

  // Close popovers on outside click
  useEffect(() => {
    const onOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const handleSubmit = () => {
    if (!composerDraft.trim() || isGenerating) return;
    const text = composerDraft;
    setComposerDraft('');
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const res = await api.uploadFile(file, {
          workspaceId: activeWorkspaceId,
          collectionName: 'Chat Uploads',
        });
        if (res.file) {
          setAttachedDocs((prev) => [...prev, res.file]);
          addToast(`Indexed "${res.file.original_name}" locally (${res.file.chunk_count} chunks)`, 'success');
        }
      }
      refreshDocuments();
    } catch (err) {
      addToast(err.message || 'File upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const toggleVoice = () => {
    if (!SpeechRecognition) return;
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setComposerDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const activePersonality = PERSONALITIES.find((p) => p.id === personality) || PERSONALITIES[0];
  const installedModels = modelsData.installed || [];
  const activeModel = settings.active_model || 'qwen3:8b';

  return (
    <div className="composer-container">
      <div className="composer-box">
        {/* Attachment Previews */}
        <AnimatePresence>
          {attachedDocs.length > 0 && (
            <motion.div
              className="composer-attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {attachedDocs.map((doc) => (
                <motion.span
                  key={doc.id}
                  className="attachment-chip"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <FileText size={13} style={{ color: 'var(--accent)' }} />
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.original_name}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    {doc.chunk_count}§
                  </span>
                  <button
                    style={{ color: 'var(--text-tertiary)', display: 'flex' }}
                    onClick={() => setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                    aria-label="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto-Resizing Multiline Input */}
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          rows={1}
          value={composerDraft}
          onChange={(e) => setComposerDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isGenerating
              ? streamStatus || 'HARKONNEN is thinking locally...'
              : 'Message HARKONNEN... (Enter to send, Shift+Enter for new line)'
          }
          disabled={isGenerating}
        />

        {/* Hidden Local File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Composer Toolbar */}
        <div className="composer-toolbar" ref={toolbarRef}>
          <div className="composer-toolbar-left">
            {/* Attach Local Document */}
            <button
              className="composer-pill-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isGenerating}
              title="Attach local document (PDF, DOCX, TXT, MD, CSV — processed 100% locally)"
            >
              {uploading ? <Loader2 size={14} className="spin" /> : <Paperclip size={14} />}
              <span>Attach</span>
            </button>

            {/* Model Selector */}
            <div className="composer-popover-anchor">
              <button
                className={`composer-pill-btn ${openMenu === 'model' ? 'active' : ''}`}
                onClick={() => setOpenMenu((m) => (m === 'model' ? null : 'model'))}
                title="Switch active local model"
              >
                <Cpu size={13} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{activeModel}</span>
                <ChevronDown size={12} />
              </button>

              <AnimatePresence>
                {openMenu === 'model' && (
                  <motion.div
                    className="composer-popover"
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                  >
                    <div
                      style={{
                        padding: '4px 8px 6px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      Installed Local Models
                    </div>
                    {installedModels.length === 0 ? (
                      <div style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {modelsData.ollamaOnline
                          ? 'No Ollama models installed yet.'
                          : 'Ollama is offline. Start Ollama to list local models.'}
                      </div>
                    ) : (
                      installedModels.map((m) => (
                        <button
                          key={m.name}
                          className={`composer-popover-item ${m.name === activeModel ? 'active' : ''}`}
                          onClick={() => {
                            switchActiveModel(m.name);
                            setOpenMenu(null);
                          }}
                        >
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {m.sizeGB} GB {m.quantizationLevel ? `· ${m.quantizationLevel}` : ''}
                            </div>
                          </div>
                          {m.name === activeModel && <Check size={14} />}
                        </button>
                      ))
                    )}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '5px 0' }} />
                    <button
                      className="composer-popover-item"
                      onClick={() => {
                        setOpenMenu(null);
                        setActiveModal('models');
                      }}
                    >
                      <span style={{ fontSize: 12 }}>Manage & Download Models...</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Personality Mode Selector */}
            <div className="composer-popover-anchor">
              <button
                className={`composer-pill-btn ${openMenu === 'personality' ? 'active' : ''}`}
                onClick={() => setOpenMenu((m) => (m === 'personality' ? null : 'personality'))}
                title="Assistant Personality (configurable system prompt)"
              >
                <Sparkles size={13} />
                <span>{activePersonality.shortName}</span>
                <ChevronDown size={12} />
              </button>

              <AnimatePresence>
                {openMenu === 'personality' && (
                  <motion.div
                    className="composer-popover"
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                  >
                    {PERSONALITIES.map((p) => (
                      <button
                        key={p.id}
                        className={`composer-popover-item ${p.id === personality ? 'active' : ''}`}
                        onClick={() => {
                          setPersonality(p.id);
                          setOpenMenu(null);
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.35 }}>
                            {p.description}
                          </div>
                        </div>
                        {p.id === personality && <Check size={14} style={{ flexShrink: 0 }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prompt Library Quick Insert */}
            <div className="composer-popover-anchor">
              <button
                className={`composer-pill-btn ${openMenu === 'prompts' ? 'active' : ''}`}
                onClick={() => setOpenMenu((m) => (m === 'prompts' ? null : 'prompts'))}
                title="Insert from Prompt Library"
              >
                <BookMarked size={13} />
              </button>

              <AnimatePresence>
                {openMenu === 'prompts' && (
                  <motion.div
                    className="composer-popover"
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                  >
                    {prompts.map((p) => (
                      <button
                        key={p.id}
                        className="composer-popover-item"
                        onClick={() => {
                          setComposerDraft((prev) => (prev ? `${prev}\n${p.content}` : p.content));
                          setOpenMenu(null);
                          textareaRef.current?.focus();
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.category}</div>
                        </div>
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '5px 0' }} />
                    <button
                      className="composer-popover-item"
                      onClick={() => {
                        setOpenMenu(null);
                        setActiveModal('prompts');
                      }}
                    >
                      <span style={{ fontSize: 12 }}>Open Prompt Library...</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Optional Web Search Toggle (Strictly Opt-In) */}
            <button
              className={`composer-pill-btn ${useWebSearch && settings.web_search_enabled ? 'web-active' : ''}`}
              onClick={() => {
                if (!settings.web_search_enabled) {
                  setSettingsTab('privacy');
                  setActiveModal('settings');
                  addToast('Web search is disabled by default. Enable it explicitly in Privacy Settings.', 'info');
                  return;
                }
                setUseWebSearch((v) => !v);
              }}
              title={
                settings.web_search_enabled
                  ? useWebSearch
                    ? 'Web search ON for next message (external lookup)'
                    : 'Web search OFF (local knowledge only)'
                  : 'Web search disabled in Privacy Settings (click to configure)'
              }
            >
              <Globe size={13} />
              <span>{useWebSearch && settings.web_search_enabled ? 'Web On' : 'Local'}</span>
            </button>
          </div>

          <div className="composer-toolbar-right">
            {SpeechRecognition && (
              <button
                className={`btn-icon ${listening ? 'active' : ''}`}
                style={{ color: listening ? 'var(--status-danger)' : undefined }}
                onClick={toggleVoice}
                title={listening ? 'Stop voice dictation' : 'Voice dictation'}
              >
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}

            {isGenerating ? (
              <button
                className="btn-stop"
                onClick={stopGeneration}
                title="Stop generation immediately"
                aria-label="Stop generation"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                className="btn-send"
                onClick={handleSubmit}
                disabled={!composerDraft.trim()}
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="composer-footnote">
        <span>Local inference via Ollama · Single active model protection enabled</span>
        <span>Press <kbd className="kbd">Ctrl+K</kbd> for Command Palette</span>
      </div>
    </div>
  );
}
