import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Plus,
  Ghost,
  Cpu,
  Settings,
  Brain,
  FileText,
  Layers,
  BookMarked,
  Sun,
  Moon,
  PowerOff,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PERSONALITIES } from '../../data/personalities';
import './CommandPalette.css';

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    startNewChat,
    setActiveModal,
    setSettingsTab,
    theme,
    toggleTheme,
    unloadActiveModel,
    chats,
    selectChat,
    workspaces,
    switchWorkspace,
    modelsData,
    switchActiveModel,
    setPersonality,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  const items = useMemo(() => {
    const list = [
      {
        id: 'act-new',
        group: 'Actions',
        label: 'New Conversation',
        hint: 'Ctrl+Shift+O',
        icon: Plus,
        run: () => startNewChat(false),
      },
      {
        id: 'act-temp',
        group: 'Actions',
        label: 'Start Temporary Chat (Not Saved)',
        icon: Ghost,
        run: () => startNewChat(true),
      },
      {
        id: 'act-models',
        group: 'Actions',
        label: 'Manage & Benchmark Local Models',
        icon: Cpu,
        run: () => setActiveModal('models'),
      },
      {
        id: 'act-unload',
        group: 'Actions',
        label: 'Unload Active Model from VRAM / RAM',
        icon: PowerOff,
        run: () => unloadActiveModel(),
      },
      {
        id: 'act-hw',
        group: 'Actions',
        label: 'Hardware & Power-Saving Settings',
        icon: Settings,
        run: () => {
          setSettingsTab('hardware');
          setActiveModal('settings');
        },
      },
      {
        id: 'act-docs',
        group: 'Actions',
        label: 'Open Local Document Intelligence (RAG)',
        icon: FileText,
        run: () => setActiveModal('documents'),
      },
      {
        id: 'act-mem',
        group: 'Actions',
        label: 'Inspect Intelligent Local Memory',
        icon: Brain,
        run: () => setActiveModal('memory'),
      },
      {
        id: 'act-ws',
        group: 'Actions',
        label: 'Manage Projects & Workspaces',
        icon: Layers,
        run: () => setActiveModal('workspaces'),
      },
      {
        id: 'act-prompts',
        group: 'Actions',
        label: 'Open Prompt Library',
        icon: BookMarked,
        run: () => setActiveModal('prompts'),
      },
      {
        id: 'act-theme',
        group: 'Actions',
        label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`,
        icon: theme === 'dark' ? Sun : Moon,
        run: () => toggleTheme(),
      },
    ];

    for (const p of PERSONALITIES) {
      list.push({
        id: `pers-${p.id}`,
        group: 'Assistant Modes',
        label: `Mode: ${p.name}`,
        icon: Sparkles,
        run: () => setPersonality(p.id),
      });
    }

    for (const ws of workspaces) {
      list.push({
        id: `ws-${ws.id}`,
        group: 'Workspaces',
        label: `Workspace: ${ws.name}`,
        icon: Layers,
        run: () => switchWorkspace(ws.id),
      });
    }

    for (const m of modelsData.installed || []) {
      list.push({
        id: `mod-${m.name}`,
        group: 'Installed Models',
        label: `Switch model → ${m.name}`,
        hint: `${m.sizeGB} GB`,
        icon: Cpu,
        run: () => switchActiveModel(m.name),
      });
    }

    for (const c of chats.slice(0, 12)) {
      list.push({
        id: `chat-${c.id}`,
        group: 'Recent Conversations',
        label: c.title,
        icon: MessageSquare,
        run: () => selectChat(c.id),
      });
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    );
  }, [
    query,
    theme,
    workspaces,
    modelsData.installed,
    chats,
    startNewChat,
    setActiveModal,
    setSettingsTab,
    toggleTheme,
    unloadActiveModel,
    switchWorkspace,
    switchActiveModel,
    selectChat,
    setPersonality,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeItem = (item) => {
    if (!item) return;
    setCommandPaletteOpen(false);
    item.run();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(items[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          className="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCommandPaletteOpen(false);
          }}
        >
          <motion.div
            className="palette-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Command Palette"
          >
            <div className="palette-input-row">
              <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command, search chats, switch model or workspace..."
                autoFocus
              />
              <span className="kbd">Esc</span>
            </div>

            <div className="palette-list">
              {items.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  No matching commands
                </div>
              ) : (
                items.map((item, idx) => {
                  const Icon = item.icon;
                  const showGroup = idx === 0 || items[idx - 1].group !== item.group;
                  return (
                    <React.Fragment key={item.id}>
                      {showGroup && <div className="palette-group-label">{item.group}</div>}
                      <button
                        className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => executeItem(item)}
                      >
                        <span className="palette-item-left">
                          <Icon size={14} style={{ flexShrink: 0 }} />
                          <span className="palette-item-title">{item.label}</span>
                        </span>
                        {item.hint && <span className="kbd">{item.hint}</span>}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <div className="palette-footer">
              <span>Navigate with ↑ ↓ · Run with Enter</span>
              <span>HARKONNEN Command Palette</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
