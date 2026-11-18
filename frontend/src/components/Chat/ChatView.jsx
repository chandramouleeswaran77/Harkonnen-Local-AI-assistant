import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PanelLeftOpen,
  Search,
  Download,
  Printer,
  Command,
  ArrowDown,
  Ghost,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { SkeletonList } from '../Common/ConfirmDialog';
import './Chat.css';

export function ChatView() {
  const {
    sidebarOpen,
    setSidebarOpen,
    activeChat,
    setActiveChat,
    activeChatId,
    messages,
    setMessages,
    loadingChat,
    temporaryMode,
    settings,
    isGenerating,
    sendMessage,
    setComposerDraft,
    setCommandPaletteOpen,
    activeWorkspaceId,
    refreshMemories,
    addToast,
  } = useApp();

  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearch, setInChatSearch] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const scrollRef = useRef(null);
  const userScrolledUpRef = useRef(false);

  // Estimate context consumption (~4 chars per token)
  const contextEstimate = useMemo(() => {
    const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const estTokens = Math.round(totalChars / 4);
    const limit = Number(settings.num_ctx || 4096);
    const pct = Math.min(100, Math.round((estTokens / limit) * 100));
    return { estTokens, limit, pct };
  }, [messages, settings.num_ctx]);

  // Smooth auto-scroll on new messages unless user intentionally scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userScrolledUpRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: isGenerating ? 'auto' : 'smooth' });
  }, [messages, isGenerating]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAway = distFromBottom > 120;
    userScrolledUpRef.current = isAway;
    setShowScrollBottom(isAway);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolledUpRef.current = false;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const handleRegenerate = (prevUserMsg) => {
    if (!prevUserMsg) return;
    sendMessage(prevUserMsg.content, { regenerateFromUserMessageId: prevUserMsg.id });
  };

  const handleEditResend = (messageId, newText) => {
    sendMessage(newText, { editMessageId: messageId });
  };

  const handleFeedback = async (messageId, feedback) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
    try {
      await api.setMessageFeedback(messageId, feedback);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleSwitchBranch = async (targetMessageId) => {
    if (!activeChatId || !targetMessageId) return;
    try {
      const data = await api.activateBranch(activeChatId, targetMessageId);
      setMessages(data.messages || []);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleSaveMemory = async (content) => {
    const snippet = (content || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!snippet) return;
    try {
      await api.createMemory({
        content: snippet,
        category: 'saved',
        workspaceId: activeWorkspaceId,
        sourceChatId: activeChatId,
      });
      refreshMemories();
      addToast('Saved excerpt to Local Memory', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleSummarizeChat = async () => {
    if (!activeChatId || summarizing) return;
    setSummarizing(true);
    try {
      const res = await api.summarizeChat(activeChatId);
      setActiveChat((prev) => ({ ...(prev || {}), summary: res.summary }));
      addToast('Conversation summary generated locally', 'success');
    } catch (err) {
      addToast(err.message || 'Could not summarize conversation', 'error');
    } finally {
      setSummarizing(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeChatId) return;
    window.open(api.exportChatUrl(activeChatId), '_blank');
  };

  const handleExportPdf = () => {
    window.print();
  };

  const searchLower = inChatSearch.trim().toLowerCase();

  return (
    <div className="chat-view">
      {/* Minimal Glass Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          {!sidebarOpen && (
            <button
              className="btn-icon"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar (Ctrl+B)"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}

          {temporaryMode ? (
            <span className="badge badge-accent">
              <Ghost size={12} />
              Temporary Chat
            </span>
          ) : (
            <span className="chat-header-title">
              {activeChat?.title || 'HARKONNEN'}
            </span>
          )}
        </div>

        <div className="chat-header-right">
          {/* Context Usage Indicator */}
          {messages.length > 0 && (
            <div
              className="context-meter"
              title={`Estimated context usage: ~${contextEstimate.estTokens} / ${contextEstimate.limit} tokens`}
            >
              <span>{contextEstimate.pct}% ctx</span>
              <div className="context-meter-bar">
                <div
                  className="context-meter-fill"
                  style={{
                    width: `${contextEstimate.pct}%`,
                    background:
                      contextEstimate.pct > 85
                        ? 'var(--status-danger)'
                        : contextEstimate.pct > 65
                        ? 'var(--status-warning)'
                        : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}

          {/* In-chat Message Search */}
          {messages.length > 0 && (
            inChatSearchOpen ? (
              <div className="in-chat-search-bar">
                <Search size={13} style={{ color: 'var(--text-tertiary)' }} />
                <input
                  value={inChatSearch}
                  onChange={(e) => setInChatSearch(e.target.value)}
                  placeholder="Find in chat..."
                  autoFocus
                />
                <button
                  className="btn-icon"
                  style={{ width: 20, height: 20 }}
                  onClick={() => {
                    setInChatSearch('');
                    setInChatSearchOpen(false);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                className="btn-icon"
                onClick={() => setInChatSearchOpen(true)}
                title="Search within this conversation"
              >
                <Search size={15} />
              </button>
            )
          )}

          {/* Summarize & Export Controls */}
          {activeChatId && messages.length > 1 && (
            <>
              <button
                className="btn-icon"
                onClick={handleSummarizeChat}
                disabled={summarizing || isGenerating}
                title="Generate local conversation summary"
              >
                {summarizing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              </button>
              <button
                className="btn-icon"
                onClick={handleExportMarkdown}
                title="Export conversation as Markdown"
              >
                <Download size={15} />
              </button>
              <button
                className="btn-icon"
                onClick={handleExportPdf}
                title="Export / Print conversation as PDF"
              >
                <Printer size={15} />
              </button>
            </>
          )}

          {/* Command Palette Trigger */}
          <button
            className="btn-icon"
            onClick={() => setCommandPaletteOpen(true)}
            title="Command Palette (Ctrl+K)"
          >
            <Command size={15} />
          </button>
        </div>
      </header>

      {/* Main Message Area or Welcome Screen */}
      {loadingChat ? (
        <div className="messages-scroll">
          <div className="messages-inner">
            <SkeletonList count={4} height={68} />
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="messages-scroll" style={{ display: 'flex' }}>
          <WelcomeScreen
            onPickPrompt={(promptText) => {
              setComposerDraft(promptText);
            }}
          />
        </div>
      ) : (
        <div className="messages-scroll" ref={scrollRef} onScroll={handleScroll}>
          {activeChat?.summary && (
            <div className="chat-summary-banner">
              <Sparkles size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Summary:</strong> {activeChat.summary}
              </div>
            </div>
          )}

          <div className="messages-inner">
            {messages.map((msg, idx) => {
              const prevUser =
                msg.role === 'assistant'
                  ? [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user')
                  : null;
              const isMatch =
                searchLower.length > 0 &&
                (msg.content || '').toLowerCase().includes(searchLower);

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  prevUserMessage={prevUser}
                  isSearchMatch={isMatch}
                  isGenerating={isGenerating}
                  onRegenerate={handleRegenerate}
                  onEditResend={handleEditResend}
                  onFeedback={handleFeedback}
                  onSwitchBranch={handleSwitchBranch}
                  onSaveMemory={handleSaveMemory}
                  onQuickAction={(text) => sendMessage(text)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Smooth Scroll-to-Bottom Button */}
      <AnimatePresence>
        {showScrollBottom && messages.length > 0 && (
          <motion.button
            className="scroll-bottom-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
          >
            <ArrowDown size={15} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Composer */}
      <Composer />
    </div>
  );
}
