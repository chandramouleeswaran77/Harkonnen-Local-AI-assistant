const API_BASE = '/api';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code = 'REQUEST_ERROR';
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
      if (data?.error?.code) code = data.error.code;
    } catch {
      // ignore
    }
    const err = new Error(message);
    err.status = res.status;
    err.code = code;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

/**
 * Consumes a POST Server-Sent Events stream cleanly with AbortSignal support.
 */
async function streamSSE(path, body, { onEvent, signal }) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let message = `Stream request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const block of chunks) {
        if (!block.trim()) continue;
        let eventName = 'message';
        let dataStr = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).trim();
          }
        }
        if (dataStr) {
          try {
            onEvent(eventName, JSON.parse(dataStr));
          } catch {
            onEvent(eventName, dataStr);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const api = {
  // Health & System
  getHealth: () => request('/health'),
  getSystemResources: () => request('/system/resources'),
  getSettings: () => request('/system/settings'),
  updateSettings: (updates) =>
    request('/system/settings', { method: 'PATCH', body: JSON.stringify(updates) }),
  getAnalytics: () => request('/system/analytics'),

  // Chat Streaming
  streamChat: (payload, { onEvent, signal }) =>
    streamSSE('/chat', payload, { onEvent, signal }),
  stopGeneration: (requestId) =>
    request('/chat/stop', { method: 'POST', body: JSON.stringify({ requestId }) }),

  // Chats & Folders
  listChats: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return request(`/chats${q ? `?${q}` : ''}`);
  },
  createChat: (data) => request('/chats', { method: 'POST', body: JSON.stringify(data) }),
  getChat: (id) => request(`/chats/${id}`),
  updateChat: (id, data) => request(`/chats/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChat: (id) => request(`/chats/${id}`, { method: 'DELETE' }),
  summarizeChat: (id) => request(`/chats/${id}/summarize`, { method: 'POST' }),
  exportChatUrl: (id) => `${API_BASE}/chats/${id}/export`,
  setMessageFeedback: (messageId, feedback) =>
    request(`/chats/messages/${messageId}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback }),
    }),
  activateBranch: (chatId, messageId) =>
    request(`/chats/${chatId}/messages/${messageId}/activate`, { method: 'POST' }),

  listFolders: (workspaceId) =>
    request(`/chats/folders/list${workspaceId ? `?workspaceId=${workspaceId}` : ''}`),
  createFolder: (data) => request('/chats/folders', { method: 'POST', body: JSON.stringify(data) }),
  deleteFolder: (id) => request(`/chats/folders/${id}`, { method: 'DELETE' }),

  // Models
  listModels: () => request('/models'),
  setActiveModel: (model) =>
    request('/models/active', { method: 'POST', body: JSON.stringify({ model }) }),
  pullModel: (name, { onEvent, signal }) =>
    streamSSE('/models/pull', { name, confirmed: true }, { onEvent, signal }),
  deleteModel: (name) => request(`/models/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  unloadModel: (model) =>
    request('/models/unload', { method: 'POST', body: JSON.stringify(model ? { model } : {}) }),
  benchmarkModel: (model) =>
    request('/models/benchmark', { method: 'POST', body: JSON.stringify({ model }) }),

  // Files & RAG
  listFiles: (workspaceId) =>
    request(`/files${workspaceId ? `?workspaceId=${workspaceId}` : ''}`),
  uploadFile: (file, { workspaceId, collectionName } = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (workspaceId) form.append('workspaceId', workspaceId);
    if (collectionName) form.append('collectionName', collectionName);
    return request('/files/upload', { method: 'POST', body: form });
  },
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  searchFiles: (payload) => request('/files/search', { method: 'POST', body: JSON.stringify(payload) }),

  // Memories
  listMemories: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.workspaceId) qs.set('workspaceId', params.workspaceId);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request(`/memories${q ? `?${q}` : ''}`);
  },
  createMemory: (data) => request('/memories', { method: 'POST', body: JSON.stringify(data) }),
  updateMemory: (id, data) => request(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMemory: (id) => request(`/memories/${id}`, { method: 'DELETE' }),

  // Workspaces
  listWorkspaces: () => request('/workspaces'),
  createWorkspace: (data) => request('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkspace: (id, data) => request(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWorkspace: (id) => request(`/workspaces/${id}`, { method: 'DELETE' }),

  // Prompt Library
  listPrompts: () => request('/prompts'),
  createPrompt: (data) => request('/prompts', { method: 'POST', body: JSON.stringify(data) }),
  updatePrompt: (id, data) => request(`/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePrompt: (id) => request(`/prompts/${id}`, { method: 'DELETE' }),
};
