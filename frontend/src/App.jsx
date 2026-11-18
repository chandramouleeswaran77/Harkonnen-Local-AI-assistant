import React, { lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { AppProvider } from './context/AppContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatView } from './components/Chat/ChatView';
import { ToastContainer } from './components/Common/Toast';

const ModelsModal = lazy(() =>
  import('./components/Models/ModelsModal').then((m) => ({ default: m.ModelsModal }))
);
const SettingsModal = lazy(() =>
  import('./components/Settings/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const DocumentsModal = lazy(() =>
  import('./components/Documents/DocumentsModal').then((m) => ({ default: m.DocumentsModal }))
);
const MemoryModal = lazy(() =>
  import('./components/Memory/MemoryModal').then((m) => ({ default: m.MemoryModal }))
);
const WorkspaceModal = lazy(() =>
  import('./components/Workspaces/WorkspaceModal').then((m) => ({ default: m.WorkspaceModal }))
);
const PromptsModal = lazy(() =>
  import('./components/Prompts/PromptsModal').then((m) => ({ default: m.PromptsModal }))
);
const CommandPalette = lazy(() =>
  import('./components/CommandPalette/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">
            <ChatView />
          </main>
        </div>

        <Suspense fallback={null}>
          <ModelsModal />
          <SettingsModal />
          <DocumentsModal />
          <MemoryModal />
          <WorkspaceModal />
          <PromptsModal />
          <CommandPalette />
        </Suspense>

        <ToastContainer />
      </AppProvider>
    </MotionConfig>
  );
}
