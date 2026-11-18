import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Cpu, ShieldCheck, Ghost, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SUGGESTED_PROMPTS, getGreetingByTime } from '../../data/personalities';
import { BrandMark } from '../Common/BrandMark';

export function WelcomeScreen({ onPickPrompt }) {
  const {
    settings,
    modelsData,
    systemResources,
    temporaryMode,
    setActiveModal,
    setPersonality,
  } = useApp();

  const greeting = getGreetingByTime(settings.user_name);
  const ollamaOnline = modelsData.ollamaOnline;
  const activeModel = settings.active_model || 'qwen3:8b';
  const modelStatus = systemResources?.model?.status || (ollamaOnline ? 'unloaded' : 'offline');

  return (
    <motion.div
      className="welcome-container"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="welcome-emblem"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <BrandMark size={30} />
      </motion.div>

      <div className="welcome-brand">HARKONNEN</div>
      <h1 className="welcome-headline">What are we thinking about today?</h1>
      <p className="welcome-subline">
        {greeting}. Your Intelligence. Your Machine. Your Rules.
      </p>

      {/* Model & Environment Status Strip */}
      <div className="welcome-status-strip">
        <button className="welcome-status-pill" onClick={() => setActiveModal('models')}>
          <span
            className={`status-dot ${
              modelStatus === 'loaded'
                ? 'online'
                : modelStatus === 'offline'
                ? 'offline'
                : 'idle'
            }`}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{activeModel}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            · {ollamaOnline ? (modelStatus === 'loaded' ? 'Loaded' : 'Ready on demand') : 'Ollama offline'}
          </span>
        </button>

        <span className="welcome-status-pill" style={{ cursor: 'default' }}>
          <ShieldCheck size={13} style={{ color: 'var(--status-success)' }} />
          <span>100% Local Processing</span>
        </span>

        {temporaryMode && (
          <span className="welcome-status-pill" style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)' }}>
            <Ghost size={13} />
            <span>Temporary Session — Not Saved</span>
          </span>
        )}
      </div>

      {/* Honest, actionable notice if Ollama is not running yet */}
      {!ollamaOnline && (
        <div className="welcome-offline-notice">
          <AlertTriangle size={16} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Local Ollama runtime is not currently reachable.</strong> Start Ollama on your machine (
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>ollama serve</code>) and pull{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>qwen3:8b</code> or{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>qwen3:4b</code> via the{' '}
            <button
              style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 'inherit' }}
              onClick={() => setActiveModal('models')}
            >
              Model Manager
            </button>
            .
          </div>
        </div>
      )}

      {/* Curated Prompt Cards */}
      <div className="welcome-prompts-grid">
        {SUGGESTED_PROMPTS.map((item, idx) => (
          <motion.button
            key={item.title}
            className="prompt-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.05 + idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => {
              if (item.personality) setPersonality(item.personality);
              onPickPrompt(item.prompt);
            }}
          >
            <span className="prompt-card-category">{item.category}</span>
            <span className="prompt-card-title">{item.title}</span>
            <span className="prompt-card-preview">{item.prompt}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
