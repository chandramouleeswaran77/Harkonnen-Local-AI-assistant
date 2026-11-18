import { POWER_PROFILES } from '../config.js';
import { getAllSettings, setSettingsBulk } from '../database/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('power');

class PowerService {
  constructor() {
    this.activeGenerations = new Map(); // requestId -> { model, startedAt, abortController }
    this.lastActivityAt = Date.now();
    this.idleTimer = null;
    this.unloadCallback = null;
  }

  registerUnloadCallback(fn) {
    this.unloadCallback = fn;
    this.startIdleWatchdog();
  }

  touchActivity() {
    this.lastActivityAt = Date.now();
  }

  getProfile(mode) {
    return POWER_PROFILES[mode] || POWER_PROFILES.balanced;
  }

  getCurrentModeAndConfig() {
    const settings = getAllSettings();
    const profile = this.getProfile(settings.power_mode);
    return {
      mode: profile.id,
      profile,
      settings,
    };
  }

  setPowerMode(mode, { confirmedPerformance = false } = {}) {
    if (!POWER_PROFILES[mode]) {
      const err = new Error(`Invalid power mode "${mode}".`);
      err.statusCode = 400;
      throw err;
    }
    if (mode === 'performance' && !confirmedPerformance) {
      const err = new Error(
        'Performance mode increases GPU/RAM utilization and requires explicit confirmation.'
      );
      err.statusCode = 400;
      err.code = 'CONFIRMATION_REQUIRED';
      throw err;
    }

    const profile = POWER_PROFILES[mode];
    const currentSettings = getAllSettings();
    const clampedCtx = Math.min(
      Number(currentSettings.num_ctx) || profile.defaultNumCtx,
      profile.maxNumCtx
    );

    const updates = {
      power_mode: mode,
      num_ctx: mode === 'power_saver' ? Math.min(clampedCtx, profile.defaultNumCtx) : profile.defaultNumCtx,
      idle_unload_minutes: profile.idleUnloadMinutes,
      hardware_execution: mode === 'power_saver' ? 'cpu' : mode === 'performance' ? 'gpu' : 'auto',
    };

    setSettingsBulk(updates);
    log.info(`Power mode changed to ${mode}`, updates);
    return { mode, profile, settings: getAllSettings() };
  }

  /**
   * Builds Ollama runtime options respecting power mode, context limits, and GPU/CPU selection.
   */
  buildInferenceOptions(overrides = {}) {
    const { profile, settings } = this.getCurrentModeAndConfig();

    const requestedCtx = Number(overrides.num_ctx ?? settings.num_ctx ?? profile.defaultNumCtx);
    const num_ctx = Math.max(512, Math.min(requestedCtx, profile.maxNumCtx));

    const temperature = Number(overrides.temperature ?? settings.temperature ?? 0.7);
    const top_p = Number(overrides.top_p ?? settings.top_p ?? 0.9);

    const hwExec = overrides.hardware_execution || settings.hardware_execution || 'auto';
    const options = {
      num_ctx,
      temperature: Math.max(0, Math.min(2, temperature)),
      top_p: Math.max(0.05, Math.min(1, top_p)),
    };

    if (hwExec === 'cpu') {
      options.num_gpu = 0;
    } else if (hwExec === 'gpu' && profile.id === 'performance') {
      options.num_gpu = 999;
    } else if (profile.numGpu === 0) {
      options.num_gpu = 0;
    }

    const idleMinutes = Number(settings.idle_unload_minutes ?? profile.idleUnloadMinutes);
    const keep_alive = idleMinutes > 0 ? `${idleMinutes}m` : profile.defaultKeepAlive;

    return { options, keep_alive, profile };
  }

  /**
   * Enforces single-request concurrency limit to protect GPU VRAM and thermals.
   */
  acquireGenerationSlot(requestId, model, abortController) {
    const { profile } = this.getCurrentModeAndConfig();
    if (this.activeGenerations.size >= profile.maxConcurrentRequests) {
      const err = new Error(
        'Another response is currently generating. Stop the active generation first to protect GPU and RAM.'
      );
      err.statusCode = 429;
      err.code = 'CONCURRENT_LIMIT';
      throw err;
    }
    this.touchActivity();
    this.activeGenerations.set(requestId, {
      requestId,
      model,
      startedAt: Date.now(),
      abortController,
    });
  }

  releaseGenerationSlot(requestId) {
    this.activeGenerations.delete(requestId);
    this.touchActivity();
  }

  abortGeneration(requestId) {
    const entry = this.activeGenerations.get(requestId);
    if (entry) {
      entry.abortController.abort();
      this.activeGenerations.delete(requestId);
      return true;
    }
    return false;
  }

  abortAllGenerations() {
    let count = 0;
    for (const [id, entry] of this.activeGenerations.entries()) {
      entry.abortController.abort();
      this.activeGenerations.delete(id);
      count++;
    }
    return count;
  }

  getGenerationStatus() {
    const active = Array.from(this.activeGenerations.values()).map((g) => ({
      requestId: g.requestId,
      model: g.model,
      startedAt: g.startedAt,
      elapsedMs: Date.now() - g.startedAt,
    }));
    return {
      isGenerating: active.length > 0,
      activeCount: active.length,
      active,
    };
  }

  /**
   * Lightweight periodic check: if no generation is running and user has been idle
   * longer than idle_unload_minutes, asks Ollama to unload resident models to free VRAM/RAM.
   * Never performs inference!
   */
  startIdleWatchdog() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(async () => {
      if (this.activeGenerations.size > 0) return;
      if (!this.unloadCallback) return;

      const settings = getAllSettings();
      const idleMinutes = Number(settings.idle_unload_minutes || 0);
      if (idleMinutes <= 0) return;

      const idleMs = Date.now() - this.lastActivityAt;
      if (idleMs >= idleMinutes * 60 * 1000) {
        try {
          await this.unloadCallback();
          // Reset timer so we don't repeatedly hit Ollama while idle
          this.lastActivityAt = Date.now();
        } catch {
          // Silent when Ollama is offline
        }
      }
    }, 60 * 1000);
    this.idleTimer.unref();
  }
}

export const powerService = new PowerService();
