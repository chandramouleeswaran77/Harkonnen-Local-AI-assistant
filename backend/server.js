import express from 'express';
import { CONFIG } from './config.js';
import { initDatabase } from './database/db.js';
import { corsMiddleware, securityHeaders } from './middleware/security.js';
import { requestLogger, errorHandler } from './middleware/errorHandler.js';
import { powerService } from './services/powerService.js';
import { ollamaService } from './services/ollamaService.js';
import { createLogger } from './utils/logger.js';

import chatRoutes from './routes/chat.routes.js';
import chatsRoutes from './routes/chats.routes.js';
import modelsRoutes from './routes/models.routes.js';
import systemRoutes from './routes/system.routes.js';
import filesRoutes from './routes/files.routes.js';
import memoryRoutes from './routes/memory.routes.js';
import workspacesRoutes from './routes/workspaces.routes.js';
import promptsRoutes from './routes/prompts.routes.js';

const log = createLogger('server');

// Initialize SQLite & schema migrations (never loads any LLM on startup!)
initDatabase();

// Register idle unload callback so unused models release VRAM/RAM after idle timeout
powerService.registerUnloadCallback(async () => {
  const unloaded = await ollamaService.unloadAllRunningModels();
  if (unloaded.length > 0) {
    log.info('Auto-unloaded idle local models to conserve hardware resources', { unloaded });
  }
});

const app = express();

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '5mb' }));
app.use(requestLogger);

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api', systemRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
});

app.use(errorHandler);

// Strictly bind to localhost (127.0.0.1) by default — never expose to public network
const server = app.listen(CONFIG.PORT, CONFIG.HOST, () => {
  log.info(`HARKONNEN local backend listening at http://${CONFIG.HOST}:${CONFIG.PORT}`);
  log.info(`Privacy mode: local-only | Ollama target: ${CONFIG.OLLAMA_BASE_URL} | Startup model preload: disabled`);
});

process.on('SIGINT', () => {
  log.info('Shutting down HARKONNEN backend...');
  powerService.abortAllGenerations();
  server.close(() => process.exit(0));
});
