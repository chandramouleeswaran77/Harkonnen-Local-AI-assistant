import React, { useState, useRef, useEffect } from 'react';
import {
  Cpu,
  Download,
  Trash2,
  PowerOff,
  Check,
  AlertTriangle,
  RefreshCw,
  Gauge,
  Loader2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Modal } from '../Common/Modal';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import './Models.css';

export function ModelsModal() {
  const {
    activeModal,
    setActiveModal,
    modelsData,
    refreshModels,
    switchActiveModel,
    unloadActiveModel,
    addToast,
  } = useApp();

  const isOpen = activeModal === 'models';
  const [tab, setTab] = useState('installed'); // 'installed' | 'catalog' | 'benchmark'
  const [customModel, setCustomModel] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Pull state
  const [pullConfirm, setPullConfirm] = useState(null); // { name, estimatedSizeGB, warnings }
  const [pullState, setPullState] = useState(null); // { name, status, percent }
  const pullAbortRef = useRef(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Benchmark state
  const [benchRunning, setBenchRunning] = useState(null);
  const [benchResults, setBenchResults] = useState([]);

  useEffect(() => {
    if (isOpen) refreshModels();
  }, [isOpen, refreshModels]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshModels();
    setRefreshing(false);
  };

  const startConfirmedPull = async () => {
    if (!pullConfirm) return;
    const modelName = pullConfirm.name;
    setPullConfirm(null);
    setPullState({ name: modelName, status: 'Connecting to Ollama...', percent: 0 });
    const controller = new AbortController();
    pullAbortRef.current = controller;

    try {
      await api.pullModel(modelName, {
        signal: controller.signal,
        onEvent(evt, data) {
          if (evt === 'progress') {
            setPullState({
              name: modelName,
              status: data.status || 'Downloading...',
              percent: data.percent ?? 0,
            });
          } else if (evt === 'done') {
            addToast(`Model "${modelName}" downloaded successfully`, 'success');
            refreshModels();
          } else if (evt === 'error') {
            addToast(data.message || 'Model pull failed', 'error', 5000);
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        addToast(err.message || 'Model download failed', 'error');
      } else {
        addToast(`Cancelled download of ${modelName}`, 'info');
      }
    } finally {
      setPullState(null);
      pullAbortRef.current = null;
      refreshModels();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteModel(deleteTarget);
      addToast(`Deleted model "${deleteTarget}"`, 'success');
      setDeleteTarget(null);
      refreshModels();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRunBenchmark = async (modelName) => {
    setBenchRunning(modelName);
    try {
      const res = await api.benchmarkModel(modelName);
      setBenchResults((prev) => [res, ...prev.filter((r) => r.model !== modelName)]);
      addToast(`Benchmarked ${modelName}: ${res.tokensPerSec} tok/s`, 'success');
    } catch (err) {
      addToast(err.message || 'Benchmark failed', 'error');
    } finally {
      setBenchRunning(null);
    }
  };

  const installed = modelsData.installed || [];
  const catalog = modelsData.catalog || [];

  return (
    <>
      <Modal
        open={isOpen}
        onClose={() => setActiveModal(null)}
        title="Local AI Models"
        subtitle="Manage Ollama models locally. Single active model enforcement protects your GPU & RAM."
        size="wide"
        headerRight={
          <div style={{ display: 'flex', gap: 6 }}>
            {modelsData.running?.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 11px', fontSize: 12 }}
                onClick={() => unloadActiveModel()}
                title="Unload currently loaded models from VRAM/RAM"
              >
                <PowerOff size={13} />
                <span>Unload All</span>
              </button>
            )}
            <button className="btn-icon" onClick={handleRefresh} title="Refresh Ollama models">
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
        }
      >
        {!modelsData.ollamaOnline && (
          <div className="model-warning-strip" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Ollama is currently offline.</strong> Start Ollama locally (
              <code>ollama serve</code>) to inspect installed models, pull new quantized variants, or run local inference.
            </div>
          </div>
        )}

        {/* Active Pull Progress */}
        {pullState && (
          <div className="pull-progress-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Pulling <code style={{ fontFamily: 'var(--font-mono)' }}>{pullState.name}</code>
              </span>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => pullAbortRef.current?.abort()}
              >
                <X size={13} />
                Cancel
              </button>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pullState.percent || 4}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              <span>{pullState.status}</span>
              <span>{pullState.percent != null ? `${pullState.percent}%` : ''}</span>
            </div>
          </div>
        )}

        <div className="tabs-bar">
          <button className={`tab-btn ${tab === 'installed' ? 'active' : ''}`} onClick={() => setTab('installed')}>
            Installed ({installed.length})
          </button>
          <button className={`tab-btn ${tab === 'catalog' ? 'active' : ''}`} onClick={() => setTab('catalog')}>
            Download Catalog
          </button>
          <button className={`tab-btn ${tab === 'benchmark' ? 'active' : ''}`} onClick={() => setTab('benchmark')}>
            Model Benchmark
          </button>
        </div>

        {/* INSTALLED TAB */}
        {tab === 'installed' && (
          <div className="model-list">
            {installed.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Cpu size={20} />
                </div>
                <h4>No local models found</h4>
                <p>
                  Switch to the Download Catalog tab to pull <code>qwen3:8b</code> (default) or compact 4B models like{' '}
                  <code>qwen3:4b</code> and <code>gemma3:4b</code>.
                </p>
              </div>
            ) : (
              installed.map((m) => (
                <div key={m.name} className={`model-card ${m.isActive ? 'active' : ''}`}>
                  <div className="model-card-top">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div className="model-name-row">
                        <span className="model-mono-title">{m.name}</span>
                        {m.isActive && <span className="badge badge-accent">Active</span>}
                        {m.isLoaded ? (
                          <span className="badge badge-success">
                            Loaded ({m.loadedFootprintGB} GB{m.loadedVramGB ? ` · ${m.loadedVramGB} GB VRAM` : ''})
                          </span>
                        ) : (
                          <span className="badge">Unloaded</span>
                        )}
                      </div>
                      <div className="model-meta-chips">
                        <span>Size: {m.sizeGB} GB</span>
                        {m.parameterSize && <span>· {m.parameterSize}</span>}
                        {m.quantizationLevel && <span>· {m.quantizationLevel}</span>}
                        {m.family && <span>· {m.family}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {m.isLoaded && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => unloadActiveModel(m.name)}
                        >
                          <PowerOff size={13} />
                          Unload
                        </button>
                      )}
                      {!m.isActive && (
                        <button
                          className="btn btn-accent"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => switchActiveModel(m.name)}
                        >
                          <Check size={13} />
                          Use Model
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => setDeleteTarget(m.name)}
                        title="Delete model from disk"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {m.compatibility?.warnings?.length > 0 && (
                    <div className="model-warning-strip">
                      <AlertTriangle size={14} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: 2 }} />
                      <div>{m.compatibility.warnings.join(' ')}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* DOWNLOAD CATALOG TAB */}
        {tab === 'catalog' && (
          <div>
            <div className="custom-pull-row">
              <input
                className="input"
                placeholder="Pull any Ollama model tag (e.g. qwen3:8b, qwen3:4b, gemma3:4b)..."
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
              <button
                className="btn btn-secondary"
                disabled={!customModel.trim() || Boolean(pullState) || !modelsData.ollamaOnline}
                onClick={() => {
                  setPullConfirm({
                    name: customModel.trim(),
                    estimatedSizeGB: null,
                    warnings: [],
                  });
                  setCustomModel('');
                }}
              >
                <Download size={14} />
                Pull
              </button>
            </div>

            <div className="model-list">
              {catalog.map((item) => (
                <div key={item.name} className="model-card">
                  <div className="model-card-top">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: '72%' }}>
                      <div className="model-name-row">
                        <span className="model-mono-title">{item.name}</span>
                        <span className="badge">{item.quantization}</span>
                        {item.tags.map((t) => (
                          <span key={t} className={`badge ${t === 'Default' ? 'badge-accent' : ''}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {item.description}
                      </p>
                      <div className="model-meta-chips">
                        <span>Est. download: ~{item.estimatedSizeGB} GB</span>
                        <span>· Rec. VRAM: {item.recommendedVramGB} GB</span>
                        <span>· Rec. RAM: {item.recommendedRamGB} GB</span>
                      </div>
                    </div>

                    <div>
                      {item.installed ? (
                        <span className="badge badge-success">
                          <Check size={12} /> Installed
                        </span>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          disabled={Boolean(pullState) || !modelsData.ollamaOnline}
                          onClick={() =>
                            setPullConfirm({
                              name: item.name,
                              estimatedSizeGB: item.estimatedSizeGB,
                              warnings: item.compatibility?.warnings || [],
                            })
                          }
                        >
                          <Download size={13} />
                          Download
                        </button>
                      )}
                    </div>
                  </div>

                  {item.compatibility?.warnings?.length > 0 && (
                    <div className="model-warning-strip">
                      <AlertTriangle size={14} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: 2 }} />
                      <div>{item.compatibility.warnings.join(' ')}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BENCHMARK TAB */}
        {tab === 'benchmark' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Measure real local generation latency (Time to First Token) and throughput (tokens/sec) on your machine using your current power profile. Only one model runs at a time.
            </p>
            {installed.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Gauge size={20} />
                </div>
                <h4>Install a model to benchmark</h4>
                <p>No installed Ollama models detected yet.</p>
              </div>
            ) : (
              <div className="model-list">
                {installed
                  .filter((m) => !m.name.includes('embed'))
                  .map((m) => {
                    const result = benchResults.find((r) => r.model === m.name);
                    const isRunning = benchRunning === m.name;
                    return (
                      <div key={m.name} className="model-card">
                        <div className="model-card-top">
                          <div>
                            <div className="model-mono-title">{m.name}</div>
                            <div className="model-meta-chips" style={{ marginTop: 4 }}>
                              {result ? (
                                <>
                                  <span style={{ color: 'var(--accent)' }}>{result.tokensPerSec} tok/s</span>
                                  <span>· TTFT: {result.timeToFirstTokenMs} ms</span>
                                  <span>· Total: {(result.totalDurationMs / 1000).toFixed(2)}s</span>
                                  <span>· {result.evalTokens} tokens</span>
                                </>
                              ) : (
                                <span>Not benchmarked this session</span>
                              )}
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary"
                            disabled={Boolean(benchRunning)}
                            onClick={() => handleRunBenchmark(m.name)}
                          >
                            {isRunning ? <Loader2 size={14} className="spin" /> : <Gauge size={14} />}
                            <span>{isRunning ? 'Running...' : 'Run Benchmark'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Explicit Pull Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(pullConfirm)}
        onClose={() => setPullConfirm(null)}
        onConfirm={startConfirmedPull}
        title="Confirm Model Download"
        message={
          pullConfirm
            ? `Download "${pullConfirm.name}" locally via Ollama?${
                pullConfirm.estimatedSizeGB
                  ? ` Estimated download size: ~${pullConfirm.estimatedSizeGB} GB.`
                  : ' Download size depends on the chosen model tag.'
              }`
            : ''
        }
        warning={
          pullConfirm?.warnings?.length > 0
            ? pullConfirm.warnings.join(' ')
            : 'HARKONNEN never downloads models automatically. You can cancel the download at any time.'
        }
        confirmLabel="Download Model"
      />

      {/* Explicit Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Installed Model"
        message={`Permanently delete "${deleteTarget}" from local Ollama storage? You will need to re-download it to use it again.`}
        confirmLabel="Delete Model"
        danger
        loading={deleting}
      />
    </>
  );
}
