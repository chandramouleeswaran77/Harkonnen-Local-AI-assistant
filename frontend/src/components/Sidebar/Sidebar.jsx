import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pin,
  Trash2,
  Edit3,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Settings,
  Cpu,
  Database,
  FileText,
  Brain,
  BookMarked,
  PanelLeftClose,
  Archive,
  Ghost,
  Sun,
  Moon,
  X,
  Check,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { BrandMark } from '../Common/BrandMark';
import { SkeletonList } from '../Common/ConfirmDialog';
import './Sidebar.css';

export function Sidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    theme,
    toggleTheme,
    setActiveModal,
    setSettingsTab,
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    folders,
    chats,
    archivedChats,
    showArchived,
    setShowArchived,
    chatSearch,
    setChatSearch,
    refreshChats,
    activeChatId,
    selectChat,
    startNewChat,
    temporaryMode,
    loadingInitial,
    systemResources,
    modelsData,
    workspaceDocs,
    memories,
    prompts,
    addToast,
  } = useApp();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const wsDropdownRef = useRef(null);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) {
        setWsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pinnedChats = chats.filter((c) => c.pinned);
  const folderedChatIds = new Set(chats.filter((c) => c.folder_id && !c.pinned).map((c) => c.id));
  const recentChats = chats.filter((c) => !c.pinned && !folderedChatIds.has(c.id));

  const handleRenameSubmit = async (chatId) => {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed) return;
    try {
      await api.updateChat(chatId, { title: trimmed });
      refreshChats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleTogglePin = async (e, chat) => {
    e.stopPropagation();
    try {
      await api.updateChat(chat.id, { pinned: !chat.pinned });
      refreshChats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleToggleArchive = async (e, chat) => {
    e.stopPropagation();
    try {
      await api.updateChat(chat.id, { archived: !chat.archived });
      if (activeChatId === chat.id) selectChat(null);
      refreshChats();
      addToast(chat.archived ? 'Conversation restored' : 'Conversation archived', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteChat = async (e, chat) => {
    e.stopPropagation();
    try {
      await api.deleteChat(chat.id);
      if (activeChatId === chat.id) selectChat(null);
      refreshChats();
      addToast('Conversation deleted', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.createFolder({ name: newFolderName.trim(), workspaceId: activeWorkspaceId });
      setNewFolderName('');
      setCreatingFolder(false);
      refreshChats();
      addToast('Folder created', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteFolder = async (e, folderId) => {
    e.stopPropagation();
    try {
      await api.deleteFolder(folderId);
      refreshChats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleMoveToFolder = async (e, chat, folderId) => {
    e.stopPropagation();
    try {
      await api.updateChat(chat.id, { folderId });
      refreshChats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Telemetry values (never fabricated)
  const modelStatus = systemResources?.model?.status || (modelsData.ollamaOnline ? 'unloaded' : 'offline');
  const statusDotClass =
    modelStatus === 'generating'
      ? 'generating'
      : modelStatus === 'loaded'
      ? 'online'
      : modelStatus === 'unloaded'
      ? 'idle'
      : 'offline';

  const ramPct = systemResources?.hardware?.ram?.usagePercent;
  const gpu = systemResources?.hardware?.gpu;
  const cpuPct = systemResources?.hardware?.cpu?.usagePercent;
  const powerLabel = systemResources?.power?.profile?.label || 'Balanced';

  const renderChatRow = (chat) => {
    const isEditing = renamingId === chat.id;
    return (
      <div
        key={chat.id}
        className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
        onClick={() => !isEditing && selectChat(chat.id)}
      >
        {isEditing ? (
          <input
            className="chat-rename-input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleRenameSubmit(chat.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit(chat.id);
              if (e.key === 'Escape') setRenamingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {chat.pinned ? <Pin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : null}
            <span className="chat-item-title" title={chat.title}>
              {chat.title}
            </span>
            <div className="chat-item-actions">
              <button
                className="chat-item-action-btn"
                title={chat.pinned ? 'Unpin' : 'Pin'}
                onClick={(e) => handleTogglePin(e, chat)}
              >
                <Pin size={12} />
              </button>
              <button
                className="chat-item-action-btn"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(chat.id);
                  setRenameValue(chat.title);
                }}
              >
                <Edit3 size={12} />
              </button>
              {folders.length > 0 && !chat.archived && (
                <button
                  className="chat-item-action-btn"
                  title={chat.folder_id ? 'Remove from folder' : `Move to ${folders[0].name}`}
                  onClick={(e) => handleMoveToFolder(e, chat, chat.folder_id ? null : folders[0].id)}
                >
                  <Folder size={12} />
                </button>
              )}
              <button
                className="chat-item-action-btn"
                title={chat.archived ? 'Restore' : 'Archive'}
                onClick={(e) => handleToggleArchive(e, chat)}
              >
                <Archive size={12} />
              </button>
              <button
                className="chat-item-action-btn danger"
                title="Delete"
                onClick={(e) => handleDeleteChat(e, chat)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className="sidebar-wrapper"
        initial={false}
        animate={{ width: sidebarOpen ? 276 : 0, opacity: sidebarOpen ? 1 : 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar-inner">
          {/* Brand Header */}
          <div className="sidebar-top">
            <div className="brand-lockup" onClick={() => startNewChat(false)}>
              <BrandMark size={24} />
              <span className="brand-name">HARKONNEN</span>
            </div>
            <button
              className="btn-icon"
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* Primary Actions */}
          <div className="sidebar-actions">
            <button className="btn-new-chat" onClick={() => startNewChat(false)}>
              <span className="btn-new-chat-left">
                <Plus size={15} />
                <span>New Chat</span>
              </span>
              <span className="kbd">Ctrl+⇧+O</span>
            </button>
            <button
              className={`btn-temp-chat ${temporaryMode ? 'active' : ''}`}
              onClick={() => startNewChat(!temporaryMode)}
              title={temporaryMode ? 'Exit Temporary Chat' : 'Start Temporary Chat (Not Saved)'}
            >
              <Ghost size={15} />
            </button>
          </div>

          {/* Workspace Selector */}
          <div className="workspace-dropdown" ref={wsDropdownRef}>
            <div className="workspace-bar">
              <button
                className="workspace-select-btn"
                onClick={() => setWsDropdownOpen((v) => !v)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    className="workspace-dot"
                    style={{ background: activeWs?.accent || 'var(--accent)' }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeWs?.name || 'General'}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <button
                className="btn-icon"
                onClick={() => setActiveModal('workspaces')}
                title="Manage Workspaces"
              >
                <Layers size={15} />
              </button>
            </div>

            <AnimatePresence>
              {wsDropdownOpen && (
                <motion.div
                  className="workspace-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                >
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      className={`workspace-menu-item ${ws.id === activeWorkspaceId ? 'active' : ''}`}
                      onClick={() => {
                        switchWorkspace(ws.id);
                        setWsDropdownOpen(false);
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="workspace-dot" style={{ background: ws.accent }} />
                        <span>{ws.name}</span>
                      </span>
                      {ws.id === activeWorkspaceId && <Check size={13} />}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                  <button
                    className="workspace-menu-item"
                    onClick={() => {
                      setWsDropdownOpen(false);
                      setActiveModal('workspaces');
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Plus size={13} />
                      <span>Manage Workspaces</span>
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Search Conversations */}
          <div className="sidebar-search">
            <Search size={13} className="sidebar-search-icon" />
            <input
              type="text"
              placeholder="Search chats..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
            />
            {chatSearch && (
              <button className="sidebar-search-clear" onClick={() => setChatSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Local Knowledge, Memory & Prompts Quick Grid */}
          <div className="sidebar-tools-grid">
            <button
              className="sidebar-tool-pill"
              onClick={() => setActiveModal('documents')}
              title="Local Document Intelligence (RAG)"
            >
              <FileText size={14} />
              <span>
                Docs <span className="pill-count">{workspaceDocs.length}</span>
              </span>
            </button>
            <button
              className="sidebar-tool-pill"
              onClick={() => setActiveModal('memory')}
              title="Intelligent Local Memory"
            >
              <Brain size={14} />
              <span>
                Memory <span className="pill-count">{memories.length}</span>
              </span>
            </button>
            <button
              className="sidebar-tool-pill"
              onClick={() => setActiveModal('prompts')}
              title="Prompt Library"
            >
              <BookMarked size={14} />
              <span>
                Prompts <span className="pill-count">{prompts.length}</span>
              </span>
            </button>
          </div>

          {/* Conversations Scroll Area */}
          <div className="sidebar-scroll">
            {loadingInitial ? (
              <SkeletonList count={5} height={30} />
            ) : (
              <>
                {/* Pinned */}
                {pinnedChats.length > 0 && (
                  <div>
                    <div className="sidebar-section-header">
                      <span>Pinned</span>
                    </div>
                    <div className="sidebar-list">{pinnedChats.map(renderChatRow)}</div>
                  </div>
                )}

                {/* Folders */}
                <div>
                  <div className="sidebar-section-header">
                    <span>Folders</span>
                    <button
                      className="chat-item-action-btn"
                      title="New folder"
                      onClick={() => setCreatingFolder((v) => !v)}
                    >
                      <FolderPlus size={12} />
                    </button>
                  </div>
                  {creatingFolder && (
                    <form onSubmit={handleCreateFolder} style={{ display: 'flex', gap: 4, padding: '4px 4px 6px' }}>
                      <input
                        className="input"
                        style={{ padding: '5px 8px', fontSize: 12 }}
                        placeholder="Folder name..."
                        value={newFolderName}
                        autoFocus
                        onChange={(e) => setNewFolderName(e.target.value)}
                      />
                      <button type="submit" className="btn btn-secondary" style={{ padding: '5px 8px', fontSize: 11 }}>
                        Add
                      </button>
                    </form>
                  )}
                  {folders.map((folder) => {
                    const folderChats = chats.filter((c) => c.folder_id === folder.id && !c.pinned);
                    const isOpen = expandedFolders[folder.id] !== false;
                    return (
                      <div key={folder.id}>
                        <div
                          className="folder-header"
                          onClick={() =>
                            setExpandedFolders((prev) => ({ ...prev, [folder.id]: !isOpen }))
                          }
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <Folder size={13} style={{ color: folder.color || 'var(--accent)' }} />
                            <span>{folder.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              ({folderChats.length})
                            </span>
                          </span>
                          <button
                            className="chat-item-action-btn danger"
                            onClick={(e) => handleDeleteFolder(e, folder.id)}
                            title="Delete folder"
                          >
                            <X size={11} />
                          </button>
                        </div>
                        {isOpen && folderChats.length > 0 && (
                          <div className="folder-children">{folderChats.map(renderChatRow)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Recent Conversations */}
                <div>
                  <div className="sidebar-section-header">
                    <span>Recent</span>
                    <button
                      style={{
                        fontSize: 10,
                        color: showArchived ? 'var(--accent)' : 'var(--text-tertiary)',
                        textTransform: 'none',
                      }}
                      onClick={() => setShowArchived((v) => !v)}
                    >
                      {showArchived ? 'Hide Archived' : 'Archived'}
                    </button>
                  </div>

                  {recentChats.length === 0 ? (
                    <div
                      style={{
                        padding: '14px 8px',
                        fontSize: 12,
                        color: 'var(--text-tertiary)',
                        textAlign: 'center',
                      }}
                    >
                      {chatSearch ? 'No matching conversations' : 'No conversations yet'}
                    </div>
                  ) : (
                    <div className="sidebar-list">{recentChats.map(renderChatRow)}</div>
                  )}
                </div>

                {/* Archived */}
                {showArchived && archivedChats.length > 0 && (
                  <div>
                    <div className="sidebar-section-header">
                      <span>Archived ({archivedChats.length})</span>
                    </div>
                    <div className="sidebar-list">{archivedChats.map(renderChatRow)}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Model & Hardware Protection Footer */}
          <div className="sidebar-footer">
            <button
              className="telemetry-card"
              onClick={() => setActiveModal('models')}
              title="Open Local AI Model Manager"
            >
              <div className="telemetry-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span className={`status-dot ${statusDotClass}`} />
                  <span className="telemetry-model-name">
                    {modelsData.activeModel || 'qwen3:8b'}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color:
                      modelStatus === 'offline'
                        ? 'var(--status-danger)'
                        : modelStatus === 'loaded'
                        ? 'var(--status-success)'
                        : 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {modelStatus}
                </span>
              </div>
              <div className="telemetry-row">
                <div className="telemetry-metrics">
                  <span>RAM {ramPct != null ? `${Math.round(ramPct)}%` : 'N/A'}</span>
                  <span>
                    {gpu?.available
                      ? `VRAM ${gpu.memoryUsedMB != null ? `${(gpu.memoryUsedMB / 1024).toFixed(1)}G` : 'N/A'}`
                      : `CPU ${cpuPct != null ? `${Math.round(cpuPct)}%` : 'N/A'}`}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--accent)' }}>{powerLabel}</span>
              </div>
            </button>

            <div className="sidebar-footer-bar">
              <button
                className="sidebar-footer-btn"
                onClick={() => {
                  setSettingsTab('hardware');
                  setActiveModal('settings');
                }}
                title="Hardware & Performance"
              >
                <Cpu size={14} />
                <span>Hardware</span>
              </button>
              <button
                className="sidebar-footer-btn"
                onClick={() => {
                  setSettingsTab('general');
                  setActiveModal('settings');
                }}
                title="Settings"
              >
                <Settings size={14} />
                <span>Settings</span>
              </button>
              <button
                className="btn-icon"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
