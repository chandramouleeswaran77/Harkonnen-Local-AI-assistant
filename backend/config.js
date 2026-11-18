import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  HOST: process.env.HARKONNEN_HOST || '127.0.0.1',
  PORT: Number(process.env.HARKONNEN_PORT || 3001),
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  DEFAULT_MODEL: process.env.HARKONNEN_DEFAULT_MODEL || 'qwen3:8b',
  DEFAULT_EMBED_MODEL: process.env.HARKONNEN_EMBED_MODEL || 'nomic-embed-text',
  DATA_DIR: path.join(__dirname, 'data'),
  DB_PATH: path.join(__dirname, 'data', 'harkonnen.db'),
  UPLOAD_DIR: path.join(__dirname, 'uploads'),
  MAX_UPLOAD_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB local file limit
  ALLOWED_ORIGINS: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ],
};

/**
 * Hardware-protective power modes.
 * Performance mode must be explicitly selected by the user.
 */
export const POWER_PROFILES = {
  power_saver: {
    id: 'power_saver',
    label: 'Power Saver',
    description: 'Prefer CPU or minimal VRAM footprint, shorter context, auto-unload after short idle, reduced animations.',
    defaultNumCtx: 2048,
    maxNumCtx: 4096,
    defaultKeepAlive: '2m',
    idleUnloadMinutes: 3,
    preferCpu: true,
    numGpu: 0, // 0 instructs Ollama to run on CPU where supported
    maxConcurrentRequests: 1,
    reduceMotion: true,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Single active model, moderate context window, smart memory management and balanced GPU/CPU execution.',
    defaultNumCtx: 4096,
    maxNumCtx: 8192,
    defaultKeepAlive: '5m',
    idleUnloadMinutes: 10,
    preferCpu: false,
    numGpu: -1, // Ollama auto-offload
    maxConcurrentRequests: 1,
    reduceMotion: false,
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    description: 'Higher resource allocation, full GPU acceleration when available, and extended context windows.',
    defaultNumCtx: 8192,
    maxNumCtx: 32768,
    defaultKeepAlive: '15m',
    idleUnloadMinutes: 30,
    preferCpu: false,
    numGpu: 999, // Maximum GPU layer offload
    maxConcurrentRequests: 1,
    reduceMotion: false,
    requiresExplicitConfirmation: true,
  },
};

/**
 * Curated open-weight local models with realistic Q4 download & VRAM guidance.
 */
export const RECOMMENDED_MODELS = [
  {
    name: 'qwen3:8b',
    displayName: 'Qwen3 8B (Default)',
    quantization: 'Q4_K_M',
    estimatedSizeGB: 5.2,
    recommendedVramGB: 6.0,
    recommendedRamGB: 12,
    tags: ['Default', 'Reasoning', 'Coding'],
    description: 'Versatile flagship local reasoning & coding model. Uses Q4 quantization by default.',
  },
  {
    name: 'qwen3:4b',
    displayName: 'Qwen3 4B',
    quantization: 'Q4_K_M',
    estimatedSizeGB: 2.6,
    recommendedVramGB: 3.5,
    recommendedRamGB: 8,
    tags: ['Efficient', '4GB VRAM Friendly'],
    description: 'Fast, lightweight Qwen3 variant ideal for laptops and 4GB VRAM GPUs.',
  },
  {
    name: 'gemma3:4b',
    displayName: 'Gemma 3 4B',
    quantization: 'Q4_K_M',
    estimatedSizeGB: 3.3,
    recommendedVramGB: 4.0,
    recommendedRamGB: 8,
    tags: ['Efficient', 'Writing'],
    description: 'Compact, articulate open-weight model suited for everyday writing and Q&A.',
  },
  {
    name: 'qwen2.5-coder:7b',
    displayName: 'Qwen 2.5 Coder 7B',
    quantization: 'Q4_K_M',
    estimatedSizeGB: 4.7,
    recommendedVramGB: 5.5,
    recommendedRamGB: 12,
    tags: ['Coding'],
    description: 'Specialized local coding model with strong multi-language syntax accuracy.',
  },
  {
    name: 'llama3.2:3b',
    displayName: 'Llama 3.2 3B',
    quantization: 'Q4_K_M',
    estimatedSizeGB: 2.0,
    recommendedVramGB: 2.8,
    recommendedRamGB: 6,
    tags: ['Ultra Light', 'Power Saver'],
    description: 'Ultra-responsive compact model for Power Saver mode and instant replies.',
  },
  {
    name: 'nomic-embed-text',
    displayName: 'Nomic Embed Text',
    quantization: 'F16',
    estimatedSizeGB: 0.27,
    recommendedVramGB: 0.5,
    recommendedRamGB: 2,
    tags: ['Embeddings', 'RAG'],
    description: 'High-accuracy local embedding model powering Document Intelligence RAG.',
  },
];

export const DEFAULT_SETTINGS = {
  active_model: CONFIG.DEFAULT_MODEL,
  power_mode: 'balanced',
  num_ctx: 4096,
  temperature: 0.7,
  top_p: 0.9,
  hardware_execution: 'auto', // 'auto' | 'gpu' | 'cpu'
  idle_unload_minutes: 10,
  auto_memory_enabled: false, // Privacy-first: opt-in or manual save
  web_search_enabled: false, // Disabled by default per spec
  user_name: '',
  custom_system_prompt: '',
  theme: 'dark',
};
