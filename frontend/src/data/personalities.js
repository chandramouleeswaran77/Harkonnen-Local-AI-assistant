export const PERSONALITIES = [
  {
    id: 'general',
    name: 'General Assistant',
    shortName: 'General',
    description: 'Balanced, thoughtful partner for reasoning, planning, and synthesis.',
    icon: 'sparkles',
  },
  {
    id: 'coding',
    name: 'Coding Assistant',
    shortName: 'Coding',
    description: 'Architecture, debugging, refactoring, and production-grade code.',
    icon: 'terminal',
  },
  {
    id: 'research',
    name: 'Research Assistant',
    shortName: 'Research',
    description: 'Deep structured analysis, synthesis, and local document citations.',
    icon: 'book-open',
  },
  {
    id: 'tutor',
    name: 'Learning Tutor',
    shortName: 'Tutor',
    description: 'Step-by-step intuition building with clear examples and mental models.',
    icon: 'graduation-cap',
  },
  {
    id: 'writing',
    name: 'Writing Assistant',
    shortName: 'Writing',
    description: 'Precision editing, sharp memos, essays, and tone refinement.',
    icon: 'feather',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    shortName: 'Analyst',
    description: 'Quantitative reasoning, tables, SQL/Python analytics, and math.',
    icon: 'bar-chart',
  },
];

export const SUGGESTED_PROMPTS = [
  {
    category: 'Architecture',
    title: 'Design a local-first sync engine',
    prompt: 'Design a clean local-first data synchronization architecture using SQLite and conflict-free updates. Outline the schema, trade-offs, and failure modes.',
    personality: 'coding',
  },
  {
    category: 'Reasoning',
    title: 'Compare quantized LLM trade-offs',
    prompt: 'Explain the practical differences between Q4_K_M, Q5_K_M, and Q8_0 GGUF quantization for local 4B–8B models in terms of VRAM footprint, perplexity, and speed.',
    personality: 'research',
  },
  {
    category: 'Writing',
    title: 'Distill notes into a sharp memo',
    prompt: 'Help me structure a concise one-page decision memo: Context, Core Problem, Options Evaluated, Recommendation, and Risks. Ask me for my notes first.',
    personality: 'writing',
  },
  {
    category: 'Mathematics',
    title: 'Derive attention scaling intuition',
    prompt: 'Explain why scaled dot-product attention divides by $\\sqrt{d_k}$ with a clear mathematical derivation and numerical intuition.',
    personality: 'tutor',
  },
];

export function getGreetingByTime(userName = '') {
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  return userName?.trim() ? `${greeting}, ${userName.trim()}` : greeting;
}
