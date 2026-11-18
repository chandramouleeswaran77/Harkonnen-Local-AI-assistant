import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Cpu,
  Sparkles,
  ShieldCheck,
  BarChart3,
  PowerOff,
  Zap,
  Leaf,
  Scale,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../Common/Modal';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import '../Models/Models.css';

const NAV_ITEMS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'hardware', label: 'Hardware & Power', icon: Cpu },
  { id: 'generation', label: 'AI & Prompts', icon: Sparkles },
  { id: 'privacy', label: 'Privacy & Web', icon: ShieldCheck },
  { id: 'analytics', label: 'Usage Analytics', icon: BarChart3 },
];

export function SettingsModal() {
  const {
    activeModal,
    setActiveModal,
    settingsTab,
    setSettingsTab,
    settings,
    updateSettings,
    theme,
    toggleTheme,
    systemResources,
    refreshSystemResources,
    unloadActiveModel,
    addToast,
  } = useApp();

  const isOpen = activeModal === 'settings';
  const [perfConfirmOpen, setPerfConfirmOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [userNameDraft, setUserNameDraft] = useState('');
  const [systemPromptDraft, setSystemPromptDraft] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUserNameDraft(settings.user_name || '');
      setSystemPromptDraft(settings.custom_system_prompt || '');
      refreshSystemResources();
    }
  }, [isOpen, settings.user_name, settings.custom_system_prompt, refreshSystemResources]);

  useEffect(() => {
    if (isOpen && settingsTab === 'analytics') {
      api.getAnalytics().then(setAnalytics).catch(() => {});
    }
  }, [isOpen, settingsTab]);

  const handlePowerModeClick = async (mode) => {
    if (mode === settings.power_mode) return;
    if (mode === 'performance') {
      setPerfConfirmOpen(true);
      return;
    }
    try {
      await updateSettings({ power_mode: mode }, `Switched to ${mode === 'power_saver' ? 'Power Saver' : 'Balanced'} mode`);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const confirmPerformanceMode = async () => {
    setPerfConfirmOpen(false);
    try {
      await updateSettings(
        { power_mode: 'performance', confirmedPerformance: true },
        'Performance mode enabled'
      );
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const hw = systemResources?.hardware;
  const modelInfo = systemResources?.model;
  const genInfo = systemResources?.generation;
  const currentPowerMode = settings.power_mode || 'balanced';

  return (
    <>
      <Modal
        open={isOpen}
        onClose={() => setActiveModal(null)}
        title="Settings"
        subtitle="Configure HARKONNEN appearance, hardware protection, generation parameters, and local privacy."
        size="wide"
        noBodyPad
      >
        <div className="settings-layout">
          <nav className="settings-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`settings-nav-btn ${settingsTab === item.id ? 'active' : ''}`}
                  onClick={() => setSettingsTab(item.id)}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="settings-content">
            {/* GENERAL TAB */}
            {settingsTab === 'general' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Appearance & Identity</h3>
                <p className="settings-section-desc">
                  Personalize your HARKONNEN workspace locally.
                </p>

                <div className="setting-row">
                  <div className="setting-row-info">
                    <span className="setting-row-label">Interface Theme</span>
                    <span className="setting-row-hint">Switch between Obsidian Dark and Alabaster Light themes.</span>
                  </div>
                  <button className="btn btn-secondary" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
                  </button>
                </div>

                <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="setting-row-info">
                    <span className="setting-row-label">Your Name (Optional)</span>
                    <span className="setting-row-hint">Used for personalized greetings on the welcome screen. Stored locally only.</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      placeholder="e.g. Alex"
                      value={userNameDraft}
                      onChange={(e) => setUserNameDraft(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => updateSettings({ user_name: userNameDraft.trim() }, 'Saved display name')}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HARDWARE & PERFORMANCE TAB */}
            {settingsTab === 'hardware' && (
              <>
                <div className="settings-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 className="settings-section-title">Live Hardware Telemetry</h3>
                      <p className="settings-section-desc" style={{ marginTop: 2 }}>
                        Real measurements from your machine. Metrics display "Unavailable" if sensors cannot be read.
                      </p>
                    </div>
                    <button className="btn-icon" onClick={refreshSystemResources} title="Refresh telemetry">
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  <div className="telemetry-grid">
                    <div className="telemetry-box">
                      <div className="telemetry-box-label">
                        <span>CPU Usage</span>
                        <span>{hw?.cpu?.cores ? `${hw.cpu.cores} Threads` : ''}</span>
                      </div>
                      <div className="telemetry-box-value">
                        {hw?.cpu?.usagePercent != null ? `${hw.cpu.usagePercent}%` : 'Unavailable'}
                      </div>
                      <div className="telemetry-box-sub" title={hw?.cpu?.model}>
                        {hw?.cpu?.model || 'Unavailable'}
                      </div>
                    </div>

                    <div className="telemetry-box">
                      <div className="telemetry-box-label">
                        <span>System RAM</span>
                        <span>{hw?.ram?.usagePercent != null ? `${hw.ram.usagePercent}%` : ''}</span>
                      </div>
                      <div className="telemetry-box-value">
                        {hw?.ram?.available
                          ? `${hw.ram.usedGB} / ${hw.ram.totalGB} GB`
                          : 'Unavailable'}
                      </div>
                      <div className="telemetry-box-sub">
                        {hw?.ram?.available ? `${hw.ram.freeGB} GB free` : 'Unavailable'}
                      </div>
                    </div>

                    <div className="telemetry-box">
                      <div className="telemetry-box-label">
                        <span>GPU Utilization</span>
                        <span>{hw?.gpu?.temperatureC != null ? `${hw.gpu.temperatureC}°C` : ''}</span>
                      </div>
                      <div className="telemetry-box-value">
                        {hw?.gpu?.available && hw.gpu.utilizationPercent != null
                          ? `${hw.gpu.utilizationPercent}%`
                          : 'Unavailable'}
                      </div>
                      <div className="telemetry-box-sub" title={hw?.gpu?.name || ''}>
                        {hw?.gpu?.available ? hw.gpu.name : 'No supported GPU sensor detected'}
                      </div>
                    </div>

                    <div className="telemetry-box">
                      <div className="telemetry-box-label">
                        <span>GPU Memory (VRAM)</span>
                        <span>{hw?.gpu?.memoryPercent != null ? `${hw.gpu.memoryPercent}%` : ''}</span>
                      </div>
                      <div className="telemetry-box-value">
                        {hw?.gpu?.available && hw.gpu.memoryTotalMB != null
                          ? `${(hw.gpu.memoryUsedMB / 1024).toFixed(2)} / ${(hw.gpu.memoryTotalMB / 1024).toFixed(1)} GB`
                          : 'Unavailable'}
                      </div>
                      <div className="telemetry-box-sub">
                        {hw?.gpu?.available
                          ? `${hw.gpu.memoryUsedMB} / ${hw.gpu.memoryTotalMB} MiB`
                          : 'Unavailable'}
                      </div>
                    </div>
                  </div>

                  {/* Active Model Memory Footprint Card */}
                  <div className="setting-row">
                    <div className="setting-row-info">
                      <span className="setting-row-label">
                        Active Model: <code style={{ fontFamily: 'var(--font-mono)' }}>{modelInfo?.activeModel || settings.active_model}</code>
                      </span>
                      <span className="setting-row-hint">
                        Status: <strong>{modelInfo?.status || 'Unavailable'}</strong> · Generation:{' '}
                        <strong>{genInfo?.isGenerating ? 'Running' : 'Idle'}</strong> · Footprint:{' '}
                        <strong>
                          {modelInfo?.memoryFootprintGB != null
                            ? `${modelInfo.memoryFootprintGB} GB (${modelInfo.vramFootprintGB ?? 0} GB VRAM)`
                            : 'Not loaded in memory'}
                        </strong>
                      </span>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => unloadActiveModel()}
                      title="Immediately release model from GPU VRAM & RAM"
                    >
                      <PowerOff size={13} />
                      <span>Unload</span>
                    </button>
                  </div>
                </div>

                {/* POWER MODES */}
                <div className="settings-section">
                  <h3 className="settings-section-title">Power-Saving & Thermal Protection</h3>
                  <p className="settings-section-desc">
                    Protect laptop thermals, battery, and VRAM. Performance mode requires explicit confirmation.
                  </p>

                  <div className="power-cards-grid">
                    <button
                      className={`power-card ${currentPowerMode === 'power_saver' ? 'active' : ''}`}
                      onClick={() => handlePowerModeClick('power_saver')}
                    >
                      <div className="power-card-title">
                        <span>Power Saver</span>
                        <Leaf size={15} style={{ color: 'var(--status-success)' }} />
                      </div>
                      <p className="power-card-desc">
                        Prefers CPU execution, compact 2K context, 3m idle auto-unload, reduced animations.
                      </p>
                    </button>

                    <button
                      className={`power-card ${currentPowerMode === 'balanced' ? 'active' : ''}`}
                      onClick={() => handlePowerModeClick('balanced')}
                    >
                      <div className="power-card-title">
                        <span>Balanced</span>
                        <Scale size={15} style={{ color: 'var(--accent)' }} />
                      </div>
                      <p className="power-card-desc">
                        Single active model, 4K default context, smart offload, 10m idle auto-unload.
                      </p>
                    </button>

                    <button
                      className={`power-card ${currentPowerMode === 'performance' ? 'active' : ''}`}
                      onClick={() => handlePowerModeClick('performance')}
                    >
                      <div className="power-card-title">
                        <span>Performance</span>
                        <Zap size={15} style={{ color: 'var(--status-warning)' }} />
                      </div>
                      <p className="power-card-desc">
                        Full GPU acceleration when available, up to 32K context, extended memory retention.
                      </p>
                    </button>
                  </div>

                  {/* Fine-grained Hardware Execution & Context Controls */}
                  <div className="setting-row">
                    <div className="setting-row-info">
                      <span className="setting-row-label">Hardware Execution Target</span>
                      <span className="setting-row-hint">
                        Configure GPU vs CPU execution explicitly rather than assuming one is always better.
                      </span>
                    </div>
                    <select
                      className="select"
                      style={{ width: 170 }}
                      value={settings.hardware_execution || 'auto'}
                      onChange={(e) => updateSettings({ hardware_execution: e.target.value }, 'Execution target updated')}
                    >
                      <option value="auto">Auto (Ollama Managed)</option>
                      <option value="gpu">Prefer GPU</option>
                      <option value="cpu">Force CPU (0 GPU layers)</option>
                    </select>
                  </div>

                  <div className="setting-row">
                    <div className="setting-row-info">
                      <span className="setting-row-label">Context Window ({settings.num_ctx} tokens)</span>
                      <span className="setting-row-hint">
                        Larger context windows consume significantly more VRAM & RAM.
                      </span>
                    </div>
                    <select
                      className="select"
                      style={{ width: 150 }}
                      value={settings.num_ctx || 4096}
                      onChange={(e) => updateSettings({ num_ctx: Number(e.target.value) }, 'Context length updated')}
                    >
                      <option value={2048}>2,048 (Low RAM)</option>
                      <option value={4096}>4,096 (Recommended)</option>
                      <option value={8192}>8,192 (Extended)</option>
                      {currentPowerMode === 'performance' && (
                        <>
                          <option value={16384}>16,384 (High VRAM)</option>
                          <option value={32768}>32,768 (Maximum)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="setting-row">
                    <div className="setting-row-info">
                      <span className="setting-row-label">Idle Auto-Unload</span>
                      <span className="setting-row-hint">
                        Automatically release model memory after inactivity to prevent idle GPU heat.
                      </span>
                    </div>
                    <select
                      className="select"
                      style={{ width: 150 }}
                      value={settings.idle_unload_minutes ?? 10}
                      onChange={(e) =>
                        updateSettings({ idle_unload_minutes: Number(e.target.value) }, 'Idle unload updated')
                      }
                    >
                      <option value={2}>After 2 minutes</option>
                      <option value={5}>After 5 minutes</option>
                      <option value={10}>After 10 minutes</option>
                      <option value={30}>After 30 minutes</option>
                      <option value={0}>Manual unload only</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* AI & GENERATION TAB */}
            {settingsTab === 'generation' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Generation Parameters & System Prompt</h3>
                <p className="settings-section-desc">
                  Fine-tune local sampling behavior and default instructions across all chats.
                </p>

                <div className="setting-row">
                  <div className="setting-row-info">
                    <span className="setting-row-label">Temperature ({settings.temperature})</span>
                    <span className="setting-row-hint">Lower = more deterministic and precise; higher = more creative.</span>
                  </div>
                  <input
                    type="range"
                    className="range-slider"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={settings.temperature ?? 0.7}
                    onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
                  />
                </div>

                <div className="setting-row">
                  <div className="setting-row-info">
                    <span className="setting-row-label">Top-P Nucleus Sampling ({settings.top_p})</span>
                    <span className="setting-row-hint">Controls vocabulary diversity during token sampling.</span>
                  </div>
                  <input
                    type="range"
                    className="range-slider"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={settings.top_p ?? 0.9}
                    onChange={(e) => updateSettings({ top_p: Number(e.target.value) })}
                  />
                </div>

                <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="setting-row-info">
                    <span className="setting-row-label">Global Custom System Prompt</span>
                    <span className="setting-row-hint">
                      Appended to the active assistant personality and workspace instructions.
                    </span>
                  </div>
                  <textarea
                    className="textarea"
                    rows={5}
                    placeholder="e.g. Always be concise, prefer TypeScript examples, and explain trade-offs clearly."
                    value={systemPromptDraft}
                    onChange={(e) => setSystemPromptDraft(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-accent"
                      onClick={() =>
                        updateSettings({ custom_system_prompt: systemPromptDraft }, 'System prompt saved')
                      }
                    >
                      Save System Prompt
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PRIVACY & WEB TAB */}
            {settingsTab === 'privacy' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Privacy & External Access Controls</h3>
                <p className="settings-section-desc">
                  HARKONNEN operates strictly locally by default. No telemetry, no cloud inference, no API keys required.
                </p>

                <div className="setting-row">
                  <div className="setting-row-info">
                    <span className="setting-row-label">Automatic Local Memory Extraction</span>
                    <span className="setting-row-hint">
                      When enabled, detects explicit statements like "I prefer..." and stores them in local SQLite. Passwords, keys, and payment info are always blocked.
                    </span>
                  </div>
                  <button
                    className={`toggle-switch ${settings.auto_memory_enabled ? 'on' : ''}`}
                    onClick={() =>
                      updateSettings(
                        { auto_memory_enabled: !settings.auto_memory_enabled },
                        settings.auto_memory_enabled ? 'Auto-memory disabled' : 'Auto-memory enabled (sensitive info blocked)'
                      )
                    }
                    aria-label="Toggle automatic local memory"
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-row-info">
                    <span className="setting-row-label">Optional Web Search Integration</span>
                    <span className="setting-row-hint">
                      Disabled by default. When enabled, you can toggle Web Search per message. Retrieved web snippets are explicitly labeled separately from local model knowledge.
                    </span>
                  </div>
                  <button
                    className={`toggle-switch ${settings.web_search_enabled ? 'on' : ''}`}
                    onClick={() =>
                      updateSettings(
                        { web_search_enabled: !settings.web_search_enabled },
                        settings.web_search_enabled
                          ? 'Web search disabled (strict offline mode)'
                          : 'Optional web search enabled — toggle per message in composer'
                      )
                    }
                    aria-label="Toggle optional web search"
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>

                <div className="entity-card">
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-success)' }}>
                    Local-First Security Posture
                  </div>
                  <ul style={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.7 }}>
                    <li>Backend API bound strictly to <code>127.0.0.1</code> (localhost only) with strict origin filtering.</li>
                    <li>All conversations, memories, and RAG document chunks persist exclusively in local SQLite.</li>
                    <li>Uploaded documents are parsed and indexed on your machine — never sent to cloud endpoints.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* USAGE ANALYTICS TAB */}
            {settingsTab === 'analytics' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Local Usage Analytics</h3>
                <p className="settings-section-desc">
                  Stored exclusively in your local database to help you evaluate model speed and efficiency.
                </p>

                <div className="telemetry-grid">
                  <div className="telemetry-box">
                    <div className="telemetry-box-label">Total Generations</div>
                    <div className="telemetry-box-value">{analytics?.totals?.totalRequests ?? 0}</div>
                  </div>
                  <div className="telemetry-box">
                    <div className="telemetry-box-label">Output Tokens</div>
                    <div className="telemetry-box-value">
                      {(analytics?.totals?.totalOutputTokens ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="telemetry-box">
                    <div className="telemetry-box-label">Avg Generation Speed</div>
                    <div className="telemetry-box-value">
                      {analytics?.totals?.avgTokensPerSec ? `${analytics.totals.avgTokensPerSec} tok/s` : '—'}
                    </div>
                  </div>
                  <div className="telemetry-box">
                    <div className="telemetry-box-label">Avg Total Latency</div>
                    <div className="telemetry-box-value">
                      {analytics?.totals?.avgLatencyMs ? `${(analytics.totals.avgLatencyMs / 1000).toFixed(2)}s` : '—'}
                    </div>
                  </div>
                </div>

                {analytics?.byModel?.length > 0 && (
                  <div className="entity-card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Per-Model Performance</div>
                    {analytics.byModel.map((row) => (
                      <div
                        key={row.model}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12.5,
                          padding: '6px 0',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{row.model}</span>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {row.requests} reqs · {row.avgTokensPerSec} tok/s · {row.outputTokens.toLocaleString()} tok
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={perfConfirmOpen}
        onClose={() => setPerfConfirmOpen(false)}
        onConfirm={confirmPerformanceMode}
        title="Enable Performance Mode?"
        message="Performance mode maximizes GPU layer offloading, raises context window limits up to 32K tokens, and keeps models resident in VRAM/RAM longer."
        warning="This can significantly increase GPU temperatures, fan noise, and battery drain on laptops. You can switch back to Balanced or Power Saver at any time."
        confirmLabel="Enable Performance Mode"
      />
    </>
  );
}
