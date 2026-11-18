import { getDb } from '../database/db.js';

export const analyticsService = {
  recordUsage({ model, promptTokens = 0, evalTokens = 0, totalDurationMs = 0, evalDurationMs = 0, tokensPerSec = 0, powerMode = 'balanced' }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO usage_logs (model, prompt_tokens, eval_tokens, total_duration_ms, eval_duration_ms, tokens_per_sec, power_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      model,
      promptTokens,
      evalTokens,
      totalDurationMs,
      evalDurationMs,
      tokensPerSec,
      powerMode
    );
  },

  getSummary() {
    const db = getDb();
    const totals = db.prepare(`
      SELECT
        COUNT(*) as totalRequests,
        COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
        COALESCE(SUM(eval_tokens), 0) as totalOutputTokens,
        COALESCE(ROUND(AVG(NULLIF(tokens_per_sec, 0)), 1), 0) as avgTokensPerSec,
        COALESCE(ROUND(AVG(NULLIF(total_duration_ms, 0)), 0), 0) as avgLatencyMs
      FROM usage_logs
    `).get();

    const byModel = db.prepare(`
      SELECT
        model,
        COUNT(*) as requests,
        COALESCE(SUM(eval_tokens), 0) as outputTokens,
        COALESCE(ROUND(AVG(NULLIF(tokens_per_sec, 0)), 1), 0) as avgTokensPerSec,
        COALESCE(ROUND(AVG(NULLIF(total_duration_ms, 0)), 0), 0) as avgLatencyMs
      FROM usage_logs
      GROUP BY model
      ORDER BY requests DESC
    `).all();

    const recent = db.prepare(`
      SELECT * FROM usage_logs ORDER BY created_at DESC LIMIT 20
    `).all();

    return { totals, byModel, recent };
  },
};
