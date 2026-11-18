import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Highlight, themes } from 'prism-react-renderer';
import {
  Copy,
  Check,
  RotateCcw,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  Globe,
  Brain,
  Sparkles,
  Maximize2,
  Minimize2,
  BookmarkPlus,
} from 'lucide-react';
import { BrandMark } from '../Common/BrandMark';

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const lineCount = code.split('\n').length;
  const isLong = lineCount > 14;
  const [expanded, setExpanded] = useState(!isLong);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="code-block-card">
      <div className="code-block-header">
        <span>
          {language || 'text'} · {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
        <div className="code-block-actions">
          {isLong && (
            <button className="code-block-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span>{expanded ? 'Collapse' : 'Expand'}</span>
            </button>
          )}
          <button className="code-block-btn" onClick={handleCopy}>
            {copied ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <Highlight theme={themes.vsDark} code={code} language={language || 'text'}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`code-block-pre ${!expanded ? 'collapsed' : ''}`}
            style={{ ...style, background: 'transparent' }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>

      {isLong && !expanded && (
        <button className="code-expand-footer" onClick={() => setExpanded(true)}>
          Show all {lineCount} lines
        </button>
      )}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const MessageBubble = memo(function MessageBubble({
  message,
  prevUserMessage,
  isSearchMatch,
  isGenerating,
  onRegenerate,
  onEditResend,
  onFeedback,
  onSwitchBranch,
  onSaveMemory,
  onQuickAction,
}) {
  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (message.role === 'user') {
    return (
      <motion.div
        className={`message-row user ${isSearchMatch ? 'search-match' : ''}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {message.attachments?.length > 0 && (
          <div className="message-attachments-row">
            {message.attachments.map((att) => (
              <span key={att.id || att.name} className="message-attachment-pill">
                <FileText size={12} style={{ color: 'var(--accent)' }} />
                <span>{att.name}</span>
              </span>
            ))}
          </div>
        )}

        {editing ? (
          <div className="edit-message-box">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                className="btn btn-accent"
                style={{ padding: '5px 12px' }}
                disabled={!editDraft.trim() || isGenerating}
                onClick={() => {
                  setEditing(false);
                  onEditResend(message.id, editDraft.trim());
                }}
              >
                Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <div className="message-user-bubble">{message.content}</div>
        )}

        <div className="message-actions">
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>
            {formatTime(message.created_at)}
          </span>
          <button className="msg-action-btn" onClick={handleCopy} title="Copy message">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {!isGenerating && !String(message.id).startsWith('tmp-') && (
            <button
              className="msg-action-btn"
              onClick={() => {
                setEditDraft(message.content);
                setEditing(true);
              }}
              title="Edit & resend"
            >
              <Edit3 size={12} />
              <span>Edit</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Assistant Message
  const sources = message.sources || [];
  const stats = message.metadata || {};
  const hasBranches = (message.branchTotal || 1) > 1;

  return (
    <motion.div
      className={`message-row assistant ${isSearchMatch ? 'search-match' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="message-assistant-wrap">
        <div className="assistant-avatar">
          <BrandMark size={16} />
        </div>

        <div className="message-assistant-body">
          <div className="message-meta-line">
            <span className="message-model-tag">{message.model || 'HARKONNEN'}</span>
            <span>·</span>
            <span>{formatTime(message.created_at)}</span>
            {stats?.tokensPerSec > 0 && (
              <>
                <span>·</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                  {stats.tokensPerSec} tok/s
                </span>
              </>
            )}
          </div>

          {/* Collapsible Reasoning Trace (Qwen3 <think> support) */}
          {message.thinking && (
            <div className="thinking-box">
              <button className="thinking-toggle" onClick={() => setThinkingOpen((v) => !v)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Brain size={13} style={{ color: 'var(--accent)' }} />
                  <span>{message.streaming ? 'Reasoning...' : 'Reasoning process'}</span>
                </span>
                {thinkingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {thinkingOpen && <div className="thinking-content">{message.thinking}</div>}
            </div>
          )}

          {/* Main Content / Streaming Indicator / Error */}
          {message.error ? (
            <div className="message-error-box">{message.content}</div>
          ) : message.streaming && !message.content ? (
            <div className="typing-dots" aria-label="Generating response">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const raw = String(children).replace(/\n$/, '');
                    if (!inline && (match || raw.includes('\n'))) {
                      return <CodeBlock language={match?.[1] || 'text'} code={raw} />;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
              {message.streaming && <span className="streaming-cursor" />}
            </div>
          )}

          {/* Sources Citations (Clearly separating Local Documents vs Optional Web Info) */}
          {sources.length > 0 && (
            <div className="sources-strip">
              {sources.map((src, i) =>
                src.type === 'web' ? (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="source-chip web-source"
                    title={`External Web Source: ${src.title}\n${src.snippet}`}
                  >
                    <Globe size={12} />
                    <span>Web: {src.title}</span>
                  </a>
                ) : (
                  <span
                    key={i}
                    className="source-chip local-doc"
                    title={`Local Document: ${src.title} (Section ${src.section})\n${src.snippet}`}
                  >
                    <FileText size={12} />
                    <span>
                      Doc: {src.title} §{src.section}
                    </span>
                  </span>
                )
              )}
            </div>
          )}

          {/* Action Bar */}
          {!message.streaming && (
            <div className="message-actions">
              {hasBranches && (
                <div className="branch-switcher">
                  <button
                    className="chat-item-action-btn"
                    style={{ width: 18, height: 18 }}
                    disabled={message.branchPosition <= 0}
                    onClick={() => onSwitchBranch(message.siblingIds[message.branchPosition - 1])}
                    title="Previous branch"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span>
                    {message.branchPosition + 1}/{message.branchTotal}
                  </span>
                  <button
                    className="chat-item-action-btn"
                    style={{ width: 18, height: 18 }}
                    disabled={message.branchPosition >= message.branchTotal - 1}
                    onClick={() => onSwitchBranch(message.siblingIds[message.branchPosition + 1])}
                    title="Next branch"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              <button className="msg-action-btn" onClick={handleCopy} title="Copy response">
                {copied ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {!isGenerating && prevUserMessage && (
                <button
                  className="msg-action-btn"
                  onClick={() => onRegenerate(prevUserMessage)}
                  title="Regenerate response (creates new branch)"
                >
                  <RotateCcw size={13} />
                  <span>Regenerate</span>
                </button>
              )}

              {!String(message.id).startsWith('tmp-') && (
                <>
                  <button
                    className={`msg-action-btn ${message.feedback === 'up' ? 'active' : ''}`}
                    onClick={() => onFeedback(message.id, message.feedback === 'up' ? null : 'up')}
                    title="Helpful response"
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    className={`msg-action-btn ${message.feedback === 'down' ? 'active' : ''}`}
                    onClick={() => onFeedback(message.id, message.feedback === 'down' ? null : 'down')}
                    title="Needs improvement"
                  >
                    <ThumbsDown size={13} />
                  </button>
                </>
              )}

              <button
                className="msg-action-btn"
                onClick={() => onSaveMemory(message.content)}
                title="Save excerpt to Local Memory"
              >
                <BookmarkPlus size={13} />
              </button>

              {!isGenerating && !message.error && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="msg-action-btn"
                    onClick={() => setShowQuickActions((v) => !v)}
                    title="Quick follow-up actions"
                  >
                    <Sparkles size={12} />
                    <span>Actions</span>
                  </button>
                  {showQuickActions && (
                    <div
                      className="composer-popover"
                      style={{ bottom: 'calc(100% + 6px)', left: 0, minWidth: 160 }}
                      onMouseLeave={() => setShowQuickActions(false)}
                    >
                      {[
                        { label: 'Summarize concisely', prefix: 'Summarize the previous response into 3 sharp bullet points.' },
                        { label: 'Explain simpler', prefix: 'Explain the previous response more simply with a concrete example.' },
                        { label: 'Rewrite more formally', prefix: 'Rewrite the previous response in a crisp executive tone.' },
                        { label: 'Translate to Spanish', prefix: 'Translate the previous response accurately into Spanish.' },
                      ].map((act) => (
                        <button
                          key={act.label}
                          className="composer-popover-item"
                          style={{ padding: '6px 9px', fontSize: 12 }}
                          onClick={() => {
                            setShowQuickActions(false);
                            onQuickAction(act.prefix);
                          }}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
