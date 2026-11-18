import { POWER_PROFILES } from '../config.js';
import { getAllSettings, setSettingsBulk } from '../database/db.js';
import { getSystemHardwareSnapshot } from '../services/hardwareService.js';
import { ollamaService } from '../services/ollamaService.js';
import { powerService } from '../services/powerService.js';
import { analyticsService } from '../services/analyticsService.js';

export async function hardwareServiceSnapshot() {
  return getSystemHardwareSnapshot();
}

export async function getHealth(req, res) {
  const ollama = await ollamaService.checkHealth();
  res.json({
    status: 'ok',
    service: 'HARKONNEN Local API',
    timestamp: new Date().toISOString(),
    ollama,
  });
}

export async function getSystemResources(req, res, next) {
  try {
    const [hardware, ollamaHealth] = await Promise.all([
      getSystemHardwareSnapshot(),
      ollamaService.checkHealth(),
    ]);

    const runningModels = ollamaHealth.online ? await ollamaService.getRunningModels() : [];
    const { mode, profile, settings } = powerService.getCurrentModeAndConfig();
    const generation = powerService.getGenerationStatus();

    const activeModel = settings.active_model;
    const activeLoaded = runningModels.find((m) => m.name === activeModel) || runningModels[0] || null;

    res.json({
      hardware,
      ollama: {
        online: ollamaHealth.online,
        version: ollamaHealth.version,
        error: ollamaHealth.error,
      },
      model: {
        activeModel,
        loadedModel: activeLoaded?.name || null,
        status: generation.isGenerating
          ? 'generating'
          : activeLoaded
          ? 'loaded'
          : ollamaHealth.online
          ? 'unloaded'
          : 'offline',
        memoryFootprintGB: activeLoaded?.sizeGB ?? null,
        vramFootprintGB: activeLoaded?.sizeVramGB ?? null,
        runningCount: runningModels.length,
        runningModels,
      },
      generation,
      power: {
        mode,
        profile,
        profiles: POWER_PROFILES,
        numCtx: settings.num_ctx,
        idleUnloadMinutes: settings.idle_unload_minutes,
        hardwareExecution: settings.hardware_execution,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function getSettings(req, res) {
  res.json({
    settings: getAllSettings(),
    powerProfiles: POWER_PROFILES,
  });
}

export function updateSettings(req, res, next) {
  try {
    const allowedKeys = new Set([
      'active_model',
      'num_ctx',
      'temperature',
      'top_p',
      'hardware_execution',
      'idle_unload_minutes',
      'auto_memory_enabled',
      'web_search_enabled',
      'user_name',
      'custom_system_prompt',
      'theme',
    ]);

    const body = req.body || {};
    const updates = {};

    if (body.power_mode !== undefined) {
      powerService.setPowerMode(body.power_mode, {
        confirmedPerformance: Boolean(body.confirmedPerformance),
      });
    }

    for (const [k, v] of Object.entries(body)) {
      if (allowedKeys.has(k)) {
        updates[k] = v;
      }
    }

    if (Object.keys(updates).length > 0) {
      setSettingsBulk(updates);
    }

    res.json({
      settings: getAllSettings(),
      powerProfiles: POWER_PROFILES,
    });
  } catch (err) {
    next(err);
  }
}

export function getUsageAnalytics(req, res) {
  res.json(analyticsService.getSummary());
}
