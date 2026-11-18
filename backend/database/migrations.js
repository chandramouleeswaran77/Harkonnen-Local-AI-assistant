import { DEFAULT_SETTINGS } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('migrations');

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_core_schema',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          system_instructions TEXT DEFAULT '',
          icon TEXT DEFAULT 'layers',
          accent TEXT DEFAULT '#D4B483',
          default_personality TEXT DEFAULT 'general',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#9898A6',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'New Conversation',
          summary TEXT DEFAULT '',
          workspace_id TEXT,
          folder_id TEXT,
          model TEXT NOT NULL,
          personality TEXT NOT NULL DEFAULT 'general',
          pinned INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_chats_folder ON chats(folder_id);

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          parent_id TEXT,
          branch_index INTEGER NOT NULL DEFAULT 0,
          is_active_branch INTEGER NOT NULL DEFAULT 1,
          role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant')),
          content TEXT NOT NULL,
          thinking TEXT DEFAULT '',
          model TEXT,
          feedback TEXT CHECK(feedback IN ('up', 'down') OR feedback IS NULL),
          sources_json TEXT DEFAULT '[]',
          attachments_json TEXT DEFAULT '[]',
          metadata_json TEXT DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at ASC);

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          category TEXT NOT NULL DEFAULT 'general',
          content TEXT NOT NULL,
          source_chat_id TEXT,
          pinned INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_id);

        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          collection_name TEXT DEFAULT 'General',
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          char_count INTEGER NOT NULL DEFAULT 0,
          chunk_count INTEGER NOT NULL DEFAULT 0,
          embedding_model TEXT DEFAULT 'lexical-tfidf',
          preview_text TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);

        CREATE TABLE IF NOT EXISTS document_chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          embedding_json TEXT,
          tokens_est INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id, chunk_index ASC);

        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          content TEXT NOT NULL,
          category TEXT DEFAULT 'General',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT NOT NULL,
          prompt_tokens INTEGER DEFAULT 0,
          eval_tokens INTEGER DEFAULT 0,
          total_duration_ms INTEGER DEFAULT 0,
          eval_duration_ms INTEGER DEFAULT 0,
          tokens_per_sec REAL DEFAULT 0,
          power_mode TEXT DEFAULT 'balanced',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
  },
  {
    version: 2,
    name: 'seed_default_workspace_prompts_and_settings',
    up(db) {
      const wsCount = db.prepare('SELECT COUNT(*) as c FROM workspaces').get().c;
      if (wsCount === 0) {
        const insertWs = db.prepare(`
          INSERT INTO workspaces (id, name, description, system_instructions, icon, accent, default_personality, is_default)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertWs.run(
          'ws-personal',
          'General',
          'Your primary personal AI environment for everyday thinking, synthesis, and problem solving.',
          '',
          'compass',
          '#D4B483',
          'general',
          1
        );
        insertWs.run(
          'ws-coding',
          'Engineering',
          'Architecture, debugging, systems design, and clean production code.',
          'Prioritize concise, production-grade code with clear edge-case handling and architectural clarity.',
          'terminal',
          '#8EA8C3',
          'coding',
          0
        );
        insertWs.run(
          'ws-research',
          'Research & Docs',
          'Deep reading, local document analysis, synthesis, and structured inquiry.',
          'Structure responses clearly, cite uploaded documents accurately, and distinguish facts from assumptions.',
          'book-open',
          '#A3B899',
          'research',
          0
        );
      }

      const promptCount = db.prepare('SELECT COUNT(*) as c FROM prompts').get().c;
      if (promptCount === 0) {
        const insertPrompt = db.prepare(`
          INSERT INTO prompts (id, title, description, content, category)
          VALUES (?, ?, ?, ?, ?)
        `);
        insertPrompt.run(
          'pr-code-review',
          'Senior Code Review',
          'Audit code for bugs, security risks, and performance bottlenecks.',
          'Review the following code as a principal software engineer. Identify correctness bugs, edge cases, performance issues, and architectural improvements. Provide concrete refactored snippets:\n\n',
          'Coding'
        );
        insertPrompt.run(
          'pr-first-principles',
          'First-Principles Breakdown',
          'Deconstruct a complex topic into foundational truths.',
          'Explain the following topic from first principles. Break it down into core assumptions, underlying mechanisms, and practical implications:\n\n',
          'Research'
        );
        insertPrompt.run(
          'pr-executive-brief',
          'Executive Synthesis',
          'Turn raw notes or documents into a sharp decision memo.',
          'Synthesize the following material into an executive brief with: 1) Key Takeaways, 2) Risks & Trade-offs, 3) Recommended Next Steps:\n\n',
          'Writing'
        );
        insertPrompt.run(
          'pr-debug-root-cause',
          'Root-Cause Debugger',
          'Systematic hypothesis-driven debugging plan.',
          'Analyze this error or unexpected behavior. List the top 3 most likely root causes ranked by probability, how to verify each quickly, and the cleanest fix:\n\n',
          'Coding'
        );
      }

      const insertSetting = db.prepare(`
        INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
      `);
      for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        insertSetting.run(key, JSON.stringify(val));
      }
    },
  },
];

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    log.info(`Applying migration v${migration.version}: ${migration.name}`);
    const tx = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      );
    });
    tx();
  }
}
