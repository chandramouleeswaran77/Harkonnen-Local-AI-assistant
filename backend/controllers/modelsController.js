import { RECOMMENDED_MODELS } from '../config.js';
import { getSetting, setSetting } from '../database/db.js';
import { ollamaService } from '../services/ollamaService.js';
import { hardwareServiceSnapshot } from './systemController.js';
import { powerService } from '../services/powerService.js';
import { isValidModelName } from '../utils/validation.js';

export async function listModels(req, res, next) {
  try {
    const health = await ollamaService.checkHealth();
    const activeModel = getSetting('active_model');
    const hardware = await hardwareServiceSnapshot();

    let installed = [];
    let running = [];

    if (health.online) {
      [installed, running] = await Promise.all([
        ollamaService.listModels(),
        ollamaService.getRunningModels(),
      ]);
    }

    const runningMap = new Map(running.map((r) => [r.name, r]));

    const enrichedInstalled = installed.map((m) => {
      const runningInfo = runningMap.get(m.name) || null;
      const compatibility = ollamaService.assessCompatibility(m.name, m.sizeGB, hardware);
      return {
        ...m,
        isActive: m.name === activeModel,
        isLoaded: Boolean(runningInfo),
        loadedFootprintGB: runningInfo?.sizeGB ?? null,
        loadedVramGB: runningInfo?.sizeVramGB ?? null,
        expiresAt: runningInfo?.expiresAt ?? null,
        compatibility,
      };
    });

    const installedNames = new Set(installed.map((m) => m.name));
    const catalog = RECOMMENDED_MODELS.map((item) => ({
      ...item,
      installed: installedNames.has(item.name),
      compatibility: ollamaService.assessCompatibility(item.name, item.estimatedSizeGB, hardware),
    }));

    res.json({
      ollamaOnline: health.online,
      ollamaVersion: health.version,
      ollamaError: health.error,
      activeModel,
      activePull: ollamaService.activePull,
      installed: enrichedInstalled,
      running,
      catalog,
    });
  } catch (err) {
    next(err);
  }
}

export async function setActiveModel(req, res, next) {
  try {
    const { model } = req.body || {};
    if (!isValidModelName(model)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid model name.' } });
    }
    const prev = getSetting('active_model');
    setSetting('active_model', model.trim());

    // Unload previous model if different so we respect single-active-model hardware protection
    if (prev && prev !== model.trim()) {
      ollamaService.unloadModel(prev).catch(() => {});
    }

    res.json({ activeModel: model.trim() });
  } catch (err) {
    next(err);
  }
}

export async function pullModel(req, res) {
  const { name, confirmed = false } = req.body || {};
  if (!isValidModelName(name)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid model name is required.' } });
  }
  if (!confirmed) {
    return res.status(400).json({
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message: 'Explicit user confirmation is required before downloading local models.',
      },
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const send = (event, data) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    send('progress', { status: 'initializing', percent: 0 });
    await ollamaService.pullModelStream(name.trim(), {
      signal: controller.signal,
      onProgress(progress) {
        send('progress', progress);
      },
    });
    send('done', { name: name.trim(), status: 'success' });
  } catch (err) {
    send('error', { message: err.message || 'Model download failed.' });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

export async function deleteModel(req, res, next) {
  try {
    const modelName = decodeURIComponent(req.params.name || '');
    if (!isValidModelName(modelName)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid model name.' } });
    }
    await ollamaService.deleteModel(modelName);
    res.json({ deleted: true, name: modelName });
  } catch (err) {
    next(err);
  }
}

export async function unloadModel(req, res, next) {
  try {
    const { model } = req.body || {};
    if (model) {
      const ok = await ollamaService.unloadModel(model);
      return res.json({ unloaded: ok ? [model] : [] });
    }
    const unloaded = await ollamaService.unloadAllRunningModels();
    res.json({ unloaded });
  } catch (err) {
    next(err);
  }
}

export async function benchmarkModel(req, res, next) {
  try {
    const { model } = req.body || {};
    if (!isValidModelName(model)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid model name is required.' } });
    }

    const health = await ollamaService.checkHealth();
    if (!health.online) {
      return res.status(503).json({ error: { code: 'OLLAMA_OFFLINE', message: 'Ollama is not running.' } });
    }

    const controller = new AbortController();
    const requestId = `bench-${Date.now()}`;
    powerService.acquireGenerationSlot(requestId, model, controller);

    try {
      await ollamaService.ensureSingleActiveModel(model);
      const { options, keep_alive } = powerService.buildInferenceOptions({ num_ctx: 2048 });
      const startTs = Date.now();
      let firstTokenMs = null;
      let output = '';

      const stats = await ollamaService.streamChat({
        model,
        messages: [
          {
            role: 'user',
            content: 'In exactly three concise bullet points, explain why local-first AI protects user privacy.',
          },
        ],
        options,
        keep_alive,
        signal: controller.signal,
        onChunk({ content }) {
          if (content && firstTokenMs === null) {
            firstTokenMs = Date.now() - startTs;
          }
          if (content) output += content;
        },
      });

      res.json({
        model,
        timeToFirstTokenMs: firstTokenMs ?? Date.now() - startTs,
        totalDurationMs: stats?.totalDurationMs ?? Date.now() - startTs,
        evalTokens: stats?.evalTokens ?? 0,
        tokensPerSec: stats?.tokensPerSec ?? 0,
        sampleLength: output.length,
      });
    } finally {
      powerService.releaseGenerationSlot(requestId);
    }
  } catch (err) {
    next(err);
  }
}
