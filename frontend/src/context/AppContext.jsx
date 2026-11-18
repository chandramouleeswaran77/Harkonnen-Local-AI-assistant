import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Core UI state
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900);
  const [theme, setTheme] = useState(() => localStorage.getItem('harkonnen_theme') || 'dark');
  const [activeModal, setActiveModal] = useState(null); // null | 'models' | 'settings' | 'memory' | 'workspaces' | 'documents' | 'prompts'
  const [settingsTab, setSettingsTab] = useState('general');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Domain data
  const [settings, setSettings] = useState({
    active_model: 'qwen3:8b',
    power_mode: 'balanced',
    num_ctx: 4096,
    temperature: 0.7,
    top_p: 0.9,
    hardware_execution: 'auto',
    idle_unload_minutes: 10,
    auto_memory_enabled: false,
    web_search_enabled: false,
    user_name: '',
    custom_system_prompt: '',
    theme: 'dark',
  });
  const [powerProfiles, setPowerProfiles] = useState({});
  const [systemResources, setSystemResources] = useState(null);
  const [modelsData, setModelsData] = useState({
    ollamaOnline: false,
    ollamaVersion: null,
    ollamaError: null,
    activeModel: 'qwen3:8b',
    installed: [],
    running: [],
    catalog: [],
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-personal');
  const [folders, setFolders] = useState([]);
  const [chats, setChats] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Composer / Session controls
  const [personality, setPersonality] = useState('general');
  const [temporaryMode, setTemporaryMode] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState([]);
  const [workspaceDocs, setWorkspaceDocs] = useState([]);
  const [memories, setMemories] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [composerDraft, setComposerDraft] = useState('');

  // Streaming state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const streamAbortRef = useRef(null);
  const activeRequestIdRef = useRef(null);

  // Toast helper
  const addToast = useCallback((message, type = 'info', duration = 3600) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply theme & power-mode attributes to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('harkonnen_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-power-mode', settings.power_mode || 'balanced');
  }, [settings.power_mode]);

  // Refresh helpers
  const refreshSystemResources = useCallback(async () => {
    try {
      const data = await api.getSystemResources();
      setSystemResources(data);
    } catch {
      // ignore transient poll errors
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const data = await api.listModels();
      setModelsData(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await api.listWorkspaces();
      setWorkspaces(data.workspaces || []);
    } catch {
      // ignore
    }
  }, []);

  const refreshChats = useCallback(async () => {
    try {
      const [activeRes, foldersRes] = await Promise.all([
        api.listChats({
          workspaceId: activeWorkspaceId,
          archived: 0,
          search: chatSearch,
        }),
        api.listFolders(activeWorkspaceId),
      ]);
      setChats(activeRes.chats || []);
      setFolders(foldersRes.folders || []);
      if (showArchived) {
        const archRes = await api.listChats({ workspaceId: activeWorkspaceId, archived: 1 });
        setArchivedChats(archRes.chats || []);
      }
    } catch {
      // ignore
    }
  }, [activeWorkspaceId, chatSearch, showArchived]);

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await api.listFiles(activeWorkspaceId);
      setWorkspaceDocs(data.files || []);
    } catch {
      // ignore
    }
  }, [activeWorkspaceId]);

  const refreshMemories = useCallback(async () => {
    try {
      const data = await api.listMemories({ workspaceId: activeWorkspaceId });
      setMemories(data.memories || []);
    } catch {
      // ignore
    }
  }, [activeWorkspaceId]);

  const refreshPrompts = useCallback(async () => {
    try {
      const data = await api.listPrompts();
      setPrompts(data.prompts || []);
    } catch {
      // ignore
    }
  }, []);

  // Initial bootstrap load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [settingsRes, wsRes, modelsRes, sysRes, promptsRes] = await Promise.all([
          api.getSettings(),
          api.listWorkspaces(),
          api.listModels(),
          api.getSystemResources(),
          api.listPrompts(),
        ]);
        if (!mounted) return;
        if (settingsRes.settings) {
          setSettings(settingsRes.settings);
          if (settingsRes.settings.theme === 'light' || settingsRes.settings.theme === 'dark') {
            setTheme(settingsRes.settings.theme);
          }
        }
        if (settingsRes.powerProfiles) setPowerProfiles(settingsRes.powerProfiles);
        setWorkspaces(wsRes.workspaces || []);
        setModelsData(modelsRes);
        setSystemResources(sysRes);
        setPrompts(promptsRes.prompts || []);
      } catch (err) {
        addToast(`Failed to connect to local HARKONNEN backend: ${err.message}`, 'error', 6000);
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [addToast]);

  // Refresh workspace-scoped entities when workspace changes
  useEffect(() => {
    refreshChats();
    refreshDocuments();
    refreshMemories();
  }, [refreshChats, refreshDocuments, refreshMemories]);

  // Lightweight resource polling (respects Power Saver & pauses when tab is hidden)
  useEffect(() => {
    const intervalMs = settings.power_mode === 'power_saver' ? 12000 : 5000;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSystemResources();
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [settings.power_mode, refreshSystemResources]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        startNewChat();
      } else if (mod && e.key.toLowerCase() === 'b' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (activeModal) setActiveModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Load a specific conversation
  const selectChat = useCallback(async (chatId) => {
    if (!chatId) {
      setActiveChatId(null);
      setActiveChat(null);
      setMessages([]);
      return;
    }
    setTemporaryMode(false);
    setActiveChatId(chatId);
    setLoadingChat(true);
    try {
      const data = await api.getChat(chatId);
      setActiveChat(data.chat);
      setMessages(data.messages || []);
      if (data.chat?.personality) setPersonality(data.chat.personality);
      if (window.innerWidth < 900) setSidebarOpen(false);
    } catch (err) {
      addToast(err.message || 'Could not load conversation', 'error');
    } finally {
      setLoadingChat(false);
    }
  }, [addToast]);

  const startNewChat = useCallback((isTemp = false) => {
    if (isGenerating && streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    setActiveChatId(null);
    setActiveChat(null);
    setMessages([]);
    setAttachedDocs([]);
    setTemporaryMode(Boolean(isTemp));
    const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
    if (activeWs?.default_personality) {
      setPersonality(activeWs.default_personality);
    }
  }, [isGenerating, workspaces, activeWorkspaceId]);

  const switchWorkspace = useCallback((wsId) => {
    setActiveWorkspaceId(wsId);
    setActiveChatId(null);
    setActiveChat(null);
    setMessages([]);
    setAttachedDocs([]);
    const ws = workspaces.find((w) => w.id === wsId);
    if (ws?.default_personality) setPersonality(ws.default_personality);
  }, [workspaces]);

  // Settings updater
  const updateSettings = useCallback(async (updates, toastMsg = null) => {
    const res = await api.updateSettings(updates);
    setSettings(res.settings);
    if (updates.theme) setTheme(updates.theme);
    if (updates.web_search_enabled === false) setUseWebSearch(false);
    refreshSystemResources();
    if (toastMsg) addToast(toastMsg, 'success');
    return res.settings;
  }, [addToast, refreshSystemResources]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    api.updateSettings({ theme: next }).catch(() => {});
  }, [theme]);

  // Active model switch
  const switchActiveModel = useCallback(async (modelName) => {
    try {
      await api.setActiveModel(modelName);
      setSettings((prev) => ({ ...prev, active_model: modelName }));
      setModelsData((prev) => ({ ...prev, activeModel: modelName }));
      refreshModels();
      refreshSystemResources();
      addToast(`Switched active model to ${modelName}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [addToast, refreshModels, refreshSystemResources]);

  // Unload running models
  const unloadActiveModel = useCallback(async (modelName) => {
    try {
      const res = await api.unloadModel(modelName);
      refreshModels();
      refreshSystemResources();
      if (res.unloaded?.length > 0) {
        addToast(`Unloaded ${res.unloaded.join(', ')} from memory`, 'success');
      } else {
        addToast('No model was currently loaded in memory', 'info');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [addToast, refreshModels, refreshSystemResources]);

  // Stop generation
  const stopGeneration = useCallback(async () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    try {
      await api.stopGeneration(activeRequestIdRef.current);
    } catch {
      // ignore
    }
    setIsGenerating(false);
    setStreamStatus('');
  }, []);

  // Core Streaming Send Message (supports normal, temporary, edit-and-resend, and regenerate/branch)
  const sendMessage = useCallback(async (rawText, options = {}) => {
    const text = (rawText ?? '').trim();
    if (!text || isGenerating) return;

    const {
      editMessageId = null,
      regenerateFromUserMessageId = null,
      overrideTemp = temporaryMode,
    } = options;

    const modelToUse = settings.active_model;
    const currentDocs = [...attachedDocs];
    const docIds = currentDocs.map((d) => d.id);

    const tempUserId = regenerateFromUserMessageId || `tmp-user-${Date.now()}`;
    const tempAssistantId = `tmp-asst-${Date.now()}`;

    // Build optimistic UI messages
    let baseMessages = messages;
    if (editMessageId) {
      const idx = messages.findIndex((m) => m.id === editMessageId);
      if (idx >= 0) {
        baseMessages = [
          ...messages.slice(0, idx),
          { ...messages[idx], content: text },
        ];
      }
    } else if (regenerateFromUserMessageId) {
      const idx = messages.findIndex((m) => m.id === regenerateFromUserMessageId);
      if (idx >= 0) {
        baseMessages = messages.slice(0, idx + 1);
      }
    } else {
      baseMessages = [
        ...messages,
        {
          id: tempUserId,
          role: 'user',
          content: text,
          model: modelToUse,
          attachments: currentDocs.map((d) => ({ id: d.id, name: d.original_name })),
          created_at: new Date().toISOString(),
        },
      ];
    }

    const streamingPlaceholder = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      thinking: '',
      model: modelToUse,
      sources: [],
      metadata: {},
      streaming: true,
      created_at: new Date().toISOString(),
    };

    setMessages([...baseMessages, streamingPlaceholder]);
    setAttachedDocs([]);
    setIsGenerating(true);
    setStreamStatus('Connecting to local runtime...');

    const abortController = new AbortController();
    streamAbortRef.current = abortController;
    activeRequestIdRef.current = null;

    let finalChatId = activeChatId;

    try {
      await api.streamChat(
        {
          chatId: overrideTemp ? null : activeChatId,
          message: text,
          model: modelToUse,
          personality,
          workspaceId: activeWorkspaceId,
          documentIds: docIds,
          useWorkspaceDocs: workspaceDocs.length > 0,
          useWebSearch: Boolean(useWebSearch && settings.web_search_enabled),
          temporary: overrideTemp,
          history: overrideTemp ? baseMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })) : [],
          editMessageId,
          regenerateFromUserMessageId,
        },
        {
          signal: abortController.signal,
          onEvent(event, data) {
            if (event === 'meta') {
              if (data.requestId) activeRequestIdRef.current = data.requestId;
              if (data.chatId) finalChatId = data.chatId;
              if (data.status === 'generating') setStreamStatus('');
            } else if (event === 'status') {
              setStreamStatus(data.label || '');
            } else if (event === 'chat_created' || event === 'chat_updated') {
              finalChatId = data.id;
              setActiveChatId(data.id);
              setActiveChat((prev) => ({
                ...(prev || {}),
                id: data.id,
                title: data.title,
                model: modelToUse,
                personality,
              }));
              refreshChats();
            } else if (event === 'sources') {
              setMessages((prev) =>
                prev.map((m) => (m.id === tempAssistantId ? { ...m, sources: data.sources || [] } : m))
              );
            } else if (event === 'memory_saved') {
              refreshMemories();
              addToast('Saved preference to Local Memory', 'info', 2600);
            } else if (event === 'thinking') {
              setStreamStatus('Reasoning...');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, thinking: (m.thinking || '') + (data.thinking || '') }
                    : m
                )
              );
            } else if (event === 'token') {
              setStreamStatus('');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: (m.content || '') + (data.content || '') }
                    : m
                )
              );
            } else if (event === 'done') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === tempUserId && data.userMessageId) {
                    return { ...m, id: data.userMessageId };
                  }
                  if (m.id === tempAssistantId) {
                    return {
                      ...m,
                      id: data.assistantMessageId || m.id,
                      content: data.content ?? m.content,
                      thinking: data.thinking ?? m.thinking,
                      sources: data.sources ?? m.sources,
                      metadata: data.stats || {},
                      streaming: false,
                    };
                  }
                  return m;
                })
              );
            } else if (event === 'aborted') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, streaming: false, content: m.content || '_Generation stopped._' }
                    : m
                )
              );
            } else if (event === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...m,
                        streaming: false,
                        error: true,
                        content: data.message || 'Unable to generate response.',
                      }
                    : m
                )
              );
              addToast(data.message || 'Generation error', 'error', 5000);
            }
          },
        }
      );

      // Refresh persisted chat to ensure exact branch indices & IDs
      if (!overrideTemp && finalChatId) {
        const synced = await api.getChat(finalChatId);
        setActiveChat(synced.chat);
        setMessages(synced.messages || []);
        refreshChats();
      }
      refreshSystemResources();
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? { ...m, streaming: false, content: m.content || '_Generation stopped._' }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? { ...m, streaming: false, error: true, content: err.message }
              : m
          )
        );
        addToast(err.message, 'error', 5000);
      }
    } finally {
      setIsGenerating(false);
      setStreamStatus('');
      streamAbortRef.current = null;
      activeRequestIdRef.current = null;
    }
  }, [
    isGenerating,
    temporaryMode,
    settings.active_model,
    settings.web_search_enabled,
    attachedDocs,
    messages,
    activeChatId,
    personality,
    activeWorkspaceId,
    workspaceDocs.length,
    useWebSearch,
    refreshChats,
    refreshMemories,
    refreshSystemResources,
    addToast,
  ]);

  const value = {
    // UI state
    sidebarOpen,
    setSidebarOpen,
    theme,
    toggleTheme,
    activeModal,
    setActiveModal,
    settingsTab,
    setSettingsTab,
    commandPaletteOpen,
    setCommandPaletteOpen,
    toasts,
    addToast,
    dismissToast,

    // Domain
    settings,
    updateSettings,
    powerProfiles,
    systemResources,
    refreshSystemResources,
    modelsData,
    refreshModels,
    switchActiveModel,
    unloadActiveModel,

    workspaces,
    refreshWorkspaces,
    activeWorkspaceId,
    switchWorkspace,

    folders,
    chats,
    archivedChats,
    showArchived,
    setShowArchived,
    chatSearch,
    setChatSearch,
    refreshChats,

    activeChatId,
    activeChat,
    setActiveChat,
    messages,
    setMessages,
    loadingChat,
    loadingInitial,
    selectChat,
    startNewChat,

    personality,
    setPersonality,
    temporaryMode,
    setTemporaryMode,
    useWebSearch,
    setUseWebSearch,
    attachedDocs,
    setAttachedDocs,
    workspaceDocs,
    refreshDocuments,
    memories,
    refreshMemories,
    prompts,
    refreshPrompts,
    composerDraft,
    setComposerDraft,

    // Streaming
    isGenerating,
    streamStatus,
    sendMessage,
    stopGeneration,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
