import { CONFIG, RECOMMENDED_MODELS } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ollama');

class OllamaService {
  constructor() {
    this.baseUrl = CONFIG.OLLAMA_BASE_URL;
    this.activePull = null; // Prevent concurrent model downloads
  }

  async fetchWithTimeout(path, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const externalSignal = options.signal;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });
      return res;
    } finally {
      if (timer) clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  async checkHealth() {
    try {
      const res = await this.fetchWithTimeout('/api/version', { method: 'GET' }, 2000);
      if (!res.ok) {
        return { online: false, version: null, error: `Ollama returned HTTP ${res.status}` };
      }
      const data = await res.json();
      return { online: true, version: data.version || 'unknown', error: null };
    } catch (err) {
      return {
        online: false,
        version: null,
        error:
          err.name === 'AbortError'
            ? 'Ollama connection timed out (is `ollama serve` running?)'
            : 'Ollama is not reachable at ' + this.baseUrl,
      };
    }
  }

  async listModels() {
    const res = await this.fetchWithTimeout('/api/tags', { method: 'GET' }, 4000);
    if (!res.ok) {
      throw new Error(`Failed to fetch Ollama models (${res.status})`);
    }
    const data = await res.json();
    const models = (data.models || []).map((m) => ({
      name: m.name,
      model: m.model || m.name,
      sizeBytes: m.size || 0,
      sizeGB: Math.round(((m.size || 0) / 1024 ** 3) * 100) / 100,
      modifiedAt: m.modified_at || null,
      digest: m.digest || null,
      family: m.details?.family || null,
      parameterSize: m.details?.parameter_size || null,
      quantizationLevel: m.details?.quantization_level || null,
      format: m.details?.format || null,
    }));
    return models;
  }

  async getRunningModels() {
    try {
      const res = await this.fetchWithTimeout('/api/ps', { method: 'GET' }, 2500);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m) => ({
        name: m.name,
        sizeBytes: m.size || 0,
        sizeGB: Math.round(((m.size || 0) / 1024 ** 3) * 100) / 100,
        sizeVramBytes: m.size_vram || 0,
        sizeVramGB: Math.round(((m.size_vram || 0) / 1024 ** 3) * 100) / 100,
        expiresAt: m.expires_at || null,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Unloads a model from RAM/VRAM immediately using keep_alive: 0.
   */
  async unloadModel(modelName) {
    if (!modelName) return false;
    try {
      const res = await this.fetchWithTimeout(
        '/api/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, prompt: '', keep_alive: 0 }),
        },
        6000
      );
      log.info(`Requested unload for model: ${modelName}`, { ok: res.ok });
      return res.ok;
    } catch (err) {
      log.warn(`Failed to unload model ${modelName}: ${err.message}`);
      return false;
    }
  }

  async unloadAllRunningModels() {
    const running = await this.getRunningModels();
    if (running.length === 0) return [];
    const unloaded = [];
    for (const m of running) {
      const ok = await this.unloadModel(m.name);
      if (ok) unloaded.push(m.name);
    }
    return unloaded;
  }

  /**
   * Ensures only a single active chat model occupies GPU/RAM.
   * Unloads any other currently resident model before starting inference on targetModel.
   */
  async ensureSingleActiveModel(targetModel) {
    const running = await this.getRunningModels();
    for (const m of running) {
      if (m.name !== targetModel && !m.name.includes('embed')) {
        log.info(`Unloading previous model ${m.name} to enforce single active model (${targetModel})`);
        await this.unloadModel(m.name);
      }
    }
  }

  /**
   * Streams chat tokens from Ollama /api/chat.
   * Supports cancellation via AbortSignal and emits thinking + content deltas.
   */
  async streamChat({ model, messages, options, keep_alive, signal, onChunk }) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options,
        keep_alive,
      }),
      signal,
    });

    if (!res.ok) {
      let detail = `Ollama returned HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody?.error) detail = errBody.error;
      } catch {
        // ignore
      }
      const err = new Error(detail);
      err.statusCode = res.status === 404 ? 404 : 502;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalStats = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let parsed;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          const contentDelta = parsed.message?.content || '';
          const thinkingDelta = parsed.message?.thinking || '';

          if (contentDelta || thinkingDelta) {
            onChunk({
              content: contentDelta,
              thinking: thinkingDelta,
              done: false,
            });
          }

          if (parsed.done) {
            const evalCount = parsed.eval_count || 0;
            const evalDurationNs = parsed.eval_duration || 0;
            const totalDurationNs = parsed.total_duration || 0;
            const promptEvalCount = parsed.prompt_eval_count || 0;
            const tokensPerSec =
              evalDurationNs > 0
                ? Math.round((evalCount / (evalDurationNs / 1e9)) * 10) / 10
                : 0;

            finalStats = {
              promptTokens: promptEvalCount,
              evalTokens: evalCount,
              totalDurationMs: Math.round(totalDurationNs / 1e6),
              evalDurationMs: Math.round(evalDurationNs / 1e6),
              tokensPerSec,
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return finalStats;
  }

  /**
   * Pulls a model from Ollama with live streaming progress.
   * Prevents launching multiple concurrent model downloads.
   */
  async pullModelStream(modelName, { onProgress, signal }) {
    if (this.activePull) {
      const err = new Error(
        `A model download (${this.activePull}) is already in progress. Wait for it to finish before starting another.`
      );
      err.statusCode = 409;
      throw err;
    }

    this.activePull = modelName;
    try {
      const res = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
        signal,
      });

      if (!res.ok) {
        let msg = `Ollama pull failed with HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body.error) msg = body.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const evt = JSON.parse(trimmed);
              if (evt.error) throw new Error(evt.error);
              const percent =
                evt.total && evt.completed
                  ? Math.min(100, Math.round((evt.completed / evt.total) * 100))
                  : null;
              onProgress({
                status: evt.status || 'downloading',
                completed: evt.completed || 0,
                total: evt.total || 0,
                percent,
              });
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      this.activePull = null;
    }
  }

  async deleteModel(modelName) {
    const res = await this.fetchWithTimeout(
      '/api/delete',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      },
      10000
    );
    if (!res.ok) {
      let msg = `Failed to delete model (${res.status})`;
      try {
        const body = await res.json();
        if (body.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return true;
  }

  /**
   * Attempts local embeddings via Ollama ONLY if an embedding model is already installed.
   * Never silently downloads models.
   */
  async tryGenerateEmbedding(text) {
    try {
      const models = await this.listModels();
      const embedModel = models.find(
        (m) =>
          m.name.startsWith(CONFIG.DEFAULT_EMBED_MODEL) ||
          m.name.includes('embed') ||
          m.name.includes('minilm')
      );
      if (!embedModel) return null;

      const res = await this.fetchWithTimeout(
        '/api/embed',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: embedModel.name,
            input: text.slice(0, 4000),
            keep_alive: '2m',
          }),
        },
        15000
      );
      if (!res.ok) return null;
      const data = await res.json();
      const vector = data.embeddings?.[0] || data.embedding || null;
      if (!Array.isArray(vector) || vector.length === 0) return null;
      return { model: embedModel.name, vector };
    } catch {
      return null;
    }
  }

  /**
   * Computes honest hardware compatibility notes for a model given detected GPU VRAM / system RAM.
   */
  assessCompatibility(modelName, sizeGB, hardware) {
    const catalog = RECOMMENDED_MODELS.find(
      (r) => r.name === modelName || modelName.startsWith(r.name.split(':')[0] + ':' + (r.name.split(':')[1] || ''))
    );
    const estGB = sizeGB || catalog?.estimatedSizeGB || null;
    const warnings = [];

    if (estGB && hardware?.gpu?.available && hardware.gpu.memoryTotalMB) {
      const vramGB = hardware.gpu.memoryTotalMB / 1024;
      if (estGB > vramGB * 0.92) {
        warnings.push(
          `Model size (~${estGB.toFixed(1)} GB) exceeds detected GPU VRAM (${vramGB.toFixed(1)} GB). Partial CPU offload will be used.`
        );
      }
    }

    if (estGB && hardware?.ram?.available && hardware.ram.totalGB) {
      if (estGB * 1.4 > hardware.ram.totalGB) {
        warnings.push(
          `Model may heavily pressure system RAM (${hardware.ram.totalGB.toFixed(1)} GB total). Consider a smaller 3B-4B quantized model.`
        );
      }
    }

    return {
      compatible: warnings.length === 0,
      warnings,
    };
  }
}

export const ollamaService = new OllamaService();
