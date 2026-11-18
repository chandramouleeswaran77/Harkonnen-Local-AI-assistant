<div align="center">

# HARKONNEN

### *Your Intelligence. Your Machine. Your Rules.*

A local-first personal AI operating environment crafted with an obsidian architectural interface, real-time Ollama streaming, SQLite persistence, local RAG document intelligence, persistent memory, and hardware-protective GPU/RAM management.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![SQLite](https://img.shields.io/badge/SQLite-Local_WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Ollama](https://img.shields.io/badge/Runtime-Ollama_Local-111114?style=flat-square)](https://ollama.com)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Local--First-D4B483?style=flat-square)](#privacy--security)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Hardware Protection & Power Modes](#hardware-protection--power-modes)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Storing Models on a Custom Drive (Windows)](#storing-models-on-a-custom-drive-windows)
- [Project Architecture](#project-architecture)
- [API Reference](#api-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Privacy & Security](#privacy--security)

---

## Overview

**HARKONNEN** is designed to deliver the smoothness, typography, and thoughtful interaction design of commercial AI products while running **entirely on your own machine** with open-weight models via [Ollama](https://ollama.com).

- No API keys required
- No cloud inference or external telemetry
- No background model preloading or uncontrolled GPU drain
- Full ownership of your conversations, documents, and local memory in SQLite

---

## Key Features

### Obsidian Interface & Fluid Experience
- **Dark & Light Themes** — Deep obsidian dark palette with restrained champagne-gold accents plus a crisp alabaster light mode.
- **Smooth Motion & Accessibility** — Subtle Framer Motion choreography, lightweight CSS micro-transitions, `prefers-reduced-motion` support, and automatic motion reduction in **Power Saver** mode.
- **Command Palette (`Ctrl+K`)** — Instant Raycast/Linear-style keyboard launcher for actions, chats, workspaces, installed models, and assistant modes.

### Streaming Conversations & Rich Rendering
- **Real-Time SSE Streaming** — Low-latency token streaming directly from Ollama with immediate **Stop Generation** cancellation.
- **Qwen3 Reasoning Support** — Automatically parses and displays `<think>` / reasoning traces in clean collapsible panels.
- **Rich Markdown Engine** — GitHub Flavored Markdown, tables, KaTeX math rendering, and expandable syntax-highlighted code blocks with one-click copy.
- **Conversation Intelligence** — Auto-titling, on-demand local summarization, in-chat message search, **Chat Branching** on regenerate, Edit & Resend, Pinning, Folders, Archiving, **Temporary Chats** (not saved to disk), and **Markdown / PDF export**.

### Local AI Model Management & Benchmarking
- Inspect installed Ollama models, exact disk size, quantization, and live RAM/VRAM footprint.
- Automatic **hardware & VRAM compatibility warnings** computed against your real detected GPU/RAM.
- Switch active models, immediately **Unload** models from memory, pull new models with explicit confirmation & live progress, delete models, and run local latency/throughput (`tok/s`) benchmarks.

### Intelligent Local Memory
- Store preferences, tech stack conventions, and ongoing projects privately in SQLite (global or workspace-scoped).
- Inspect, search, edit, pin, and delete memories anytime.
- Built-in **Privacy Filter** blocks passwords, API keys, private keys, and payment details from ever being saved automatically.

### Document Intelligence (100% Local RAG)
- Drag-and-drop ingestion for **PDF, DOCX, TXT, Markdown, and CSV** files.
- Local text extraction, sentence-aware chunking, Ollama local embeddings (with automatic lexical TF-IDF fallback if no embedding model is installed), collection organization, and inline document source citations.

### Projects, Workspaces & Personalities
- Create isolated **Workspaces** with separate conversation histories, documents, memories, and custom system instructions.
- Switch between 6 transparent system-prompt **Assistant Personalities**: `General`, `Coding`, `Research`, `Learning Tutor`, `Writing`, and `Data Analyst`.
- Includes a reusable **Prompt Library**, optional browser **Voice Input**, local **Usage Analytics**, and an **opt-in Web Search** toggle (disabled by default).

---

## Hardware Protection & Power Modes

HARKONNEN is engineered to protect laptop thermals, battery life, and VRAM:

- **Single Active Model Policy** — Automatically unloads previously loaded chat models before switching to another model.
- **Zero Startup Preload & Zero Background Inference** — Never loads large models when you launch the app and never generates while idle.
- **Honest Live Telemetry** — Reads real OS CPU, RAM, and NVIDIA GPU/VRAM sensors (`nvidia-smi`), displaying `Unavailable` whenever a metric cannot be reliably measured.
- **Idle Auto-Unload** — Automatically releases resident model memory after a configurable inactivity timeout.

| Mode | Execution Target | Context Limit | Idle Auto-Unload | Notes |
| --- | --- | --- | --- | --- |
| **Power Saver** | Prefer CPU (`num_gpu: 0`) | 2,048 (max 4,096) | 3 minutes | Reduces nonessential animations & polling frequency |
| **Balanced** *(Default)* | Auto (Ollama managed) | 4,096 (max 8,192) | 10 minutes | Single active model, balanced GPU/RAM footprint |
| **Performance** | Prefer GPU (`num_gpu: 999`) | 8,192 (max 32,768) | 30 minutes | Requires explicit user confirmation before enabling |

---

## Technology Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 18, Vite 6, JavaScript, Modular CSS Variables, Framer Motion, Lucide React, React Markdown, `remark-gfm`, `remark-math`, `rehype-katex`, KaTeX, Prism React Renderer |
| **Backend** | Node.js 20+, Express.js, Server-Sent Events (SSE), Multer, `pdf-parse`, Mammoth |
| **Database** | SQLite (`better-sqlite3`, WAL mode, versioned schema migrations) |
| **AI Runtime** | Ollama (`http://127.0.0.1:11434`), Default model `qwen3:8b` (with `qwen3:4b` & `gemma3:4b` recommended for 4 GB VRAM GPUs) |

---

## Prerequisites

1. **Node.js 20+** — Verify with `node -v`
2. **Ollama** — Download and install from [ollama.com/download](https://ollama.com/download)

### Pull a Local Model

```bash
# Default flagship model (~5.2 GB, Q4_K_M quantization)
ollama pull qwen3:8b

# Lightweight models ideal for 4 GB VRAM laptops or Power Saver mode
ollama pull qwen3:4b
ollama pull gemma3:4b

# Optional: Local embedding model for vector RAG in Document Intelligence
ollama pull nomic-embed-text
```

> You can also download, switch, unload, benchmark, and delete models directly inside HARKONNEN's **Model Manager** UI.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/chandramouleeswaran77/Harkonnen-Local-AI-assistant.git
cd Harkonnen-Local-AI-assistant

# 2. Install root, backend, and frontend dependencies
npm install
npm run install:all

# 3. Start both the local API (127.0.0.1:3001) and React UI (127.0.0.1:5173)
npm run dev
```

Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)** in your browser.

### Production Build

```bash
npm run build
```

---

## Storing Models on a Custom Drive (Windows)

By default, Ollama stores large model weights under `C:\Users\<username>\.ollama\models`. To store models on another drive (e.g., `D:\OllamaModels`):

```cmd
mkdir D:\OllamaModels
setx OLLAMA_MODELS "D:\OllamaModels"
```

Then quit Ollama from the Windows system tray (or restart it via Task Manager / Command Prompt) and reopen Ollama so it reads the new path.

---

## Project Architecture

```text
Harkonnen/
├── package.json                  # Unified workspace scripts (dev, build, install:all)
├── backend/                      # Local-only Express server (bound to 127.0.0.1:3001)
│   ├── server.js                 # App entry point, middleware, routes, idle unload watchdog
│   ├── config.js                 # Power profiles, curated model catalog, privacy defaults
│   ├── database/
│   │   ├── db.js                 # SQLite WAL connection & settings helpers
│   │   └── migrations.js         # Versioned schema & initial seed migrations
│   ├── middleware/
│   │   ├── security.js           # Strict localhost CORS & security headers
│   │   └── errorHandler.js       # Unified error handling & request logging
│   ├── routes/                   # chat, chats, models, system, files, memory, workspaces, prompts
│   ├── controllers/              # HTTP & SSE stream controllers
│   ├── services/
│   │   ├── ollamaService.js      # Streaming /api/chat, /api/tags, /api/ps, /api/pull, unload, embed
│   │   ├── hardwareService.js    # Real OS CPU/RAM & NVIDIA GPU/VRAM telemetry
│   │   ├── powerService.js       # Power Saver / Balanced / Performance & concurrency guard
│   │   ├── documentService.js    # Local PDF/DOCX/TXT/MD/CSV ingestion, chunking & RAG search
│   │   ├── memoryService.js      # Persistent local memory retrieval & extraction
│   │   ├── personalities.js      # Configurable assistant system prompts
│   │   ├── analyticsService.js   # Local token & latency metrics
│   │   └── webSearchService.js   # Disabled-by-default opt-in web search adapter
│   └── utils/                    # Logger, validation, sensitive-info privacy filter
└── frontend/                     # React 18 + Vite 6 application
    └── src/
        ├── styles/               # tokens.css, global.css, animations.css
        ├── context/              # AppContext global state & SSE stream lifecycle
        ├── services/             # REST + SSE AbortController API client
        ├── data/                 # Personalities & curated prompt presets
        └── components/
            ├── Sidebar/          # Collapsible navigation, workspaces, folders, hardware pill
            ├── Chat/             # ChatView, WelcomeScreen, MessageBubble, Composer
            ├── Models/           # Model Manager & Benchmark modal
            ├── Settings/         # Hardware & Power, AI parameters, Privacy, Analytics
            ├── Documents/        # Local Document Intelligence (RAG) modal
            ├── Memory/           # Intelligent Local Memory manager
            ├── Workspaces/       # Projects & Workspaces manager
            ├── Prompts/          # Reusable Prompt Library modal
            ├── CommandPalette/   # Ctrl+K Command Palette
            └── Common/           # BrandMark, Modal, ConfirmDialog, Toast, Skeletons
```

---

## API Reference

All endpoints are bound strictly to `http://127.0.0.1:3001`:

| Category | Endpoints |
| --- | --- |
| **Streaming Chat** | `POST /api/chat` (SSE), `POST /api/chat/stop` |
| **Conversations** | `GET /api/chats`, `POST /api/chats`, `GET /api/chats/:id`, `PATCH /api/chats/:id`, `DELETE /api/chats/:id`, `GET /api/chats/:id/export`, `POST /api/chats/:id/summarize` |
| **Branches & Folders** | `PATCH /api/chats/messages/:messageId/feedback`, `POST /api/chats/:id/messages/:messageId/activate`, `GET/POST/DELETE /api/chats/folders` |
| **Models** | `GET /api/models`, `POST /api/models/active`, `POST /api/models/pull` (SSE), `POST /api/models/unload`, `POST /api/models/benchmark`, `DELETE /api/models/:name` |
| **System & Telemetry** | `GET /api/health`, `GET /api/system/resources`, `GET/PATCH /api/system/settings`, `GET /api/system/analytics` |
| **Documents (RAG)** | `POST /api/files/upload`, `GET /api/files`, `POST /api/files/search`, `DELETE /api/files/:id` |
| **Memory, Workspaces & Prompts** | `GET/POST/PATCH/DELETE /api/memories`, `GET/POST/PATCH/DELETE /api/workspaces`, `GET/POST/PATCH/DELETE /api/prompts` |

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Enter` | Send message |
| `Shift + Enter` | Insert new line |
| `Ctrl + K` / `Cmd + K` | Open Command Palette |
| `Ctrl + Shift + O` / `Cmd + Shift + O` | Start New Chat |
| `Ctrl + B` / `Cmd + B` | Toggle Sidebar |
| `Esc` | Close active modal or palette |

---

## Privacy & Security

- **Localhost Binding**: The backend binds strictly to `127.0.0.1` by default and blocks unauthorized cross-origin browser requests.
- **Zero Cloud Dependencies**: No mandatory API keys, no paid cloud endpoints, and no analytics or telemetry.
- **Local Data Ownership**: SQLite databases (`backend/data/`) and uploaded documents (`backend/uploads/`) stay exclusively on your local disk and are excluded from version control via `.gitignore`.
- **Explicit External Controls**: Optional web search is disabled by default and requires explicit user opt-in inside **Settings → Privacy & Web**.
