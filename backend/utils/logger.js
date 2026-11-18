const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function format(level, scope, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${scope}] ${message}`;
  if (meta !== undefined) {
    try {
      return `${base} ${JSON.stringify(meta)}`;
    } catch {
      return base;
    }
  }
  return base;
}

export function createLogger(scope) {
  return {
    error(msg, meta) {
      if (currentLevel >= LEVELS.error) console.error(format('error', scope, msg, meta));
    },
    warn(msg, meta) {
      if (currentLevel >= LEVELS.warn) console.warn(format('warn', scope, msg, meta));
    },
    info(msg, meta) {
      if (currentLevel >= LEVELS.info) console.log(format('info', scope, msg, meta));
    },
    debug(msg, meta) {
      if (currentLevel >= LEVELS.debug) console.log(format('debug', scope, msg, meta));
    },
  };
}
