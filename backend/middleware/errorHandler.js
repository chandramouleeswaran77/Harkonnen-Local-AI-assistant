import { createLogger } from '../utils/logger.js';

const log = createLogger('http');

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (req.path !== '/api/system/resources') {
      log.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
}

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  if (status >= 500) {
    log.error(`${req.method} ${req.originalUrl} failed: ${err.message}`);
  } else {
    log.warn(`${req.method} ${req.originalUrl} [${status}]: ${err.message}`);
  }
  if (res.headersSent) return;
  res.status(status).json({
    error: {
      code,
      message: err.message || 'An unexpected local server error occurred.',
    },
  });
}
