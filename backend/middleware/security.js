import cors from 'cors';
import { CONFIG } from '../config.js';

/**
 * Local-first CORS & origin protection.
 * Blocks unauthorized cross-origin web requests from arbitrary external sites.
 */
export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow non-browser / same-origin local requests (no Origin header)
    if (!origin) return callback(null, true);
    if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by HARKONNEN local security policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id'],
});

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
  next();
}
