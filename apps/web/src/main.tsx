import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';
import { ProjectSessionProvider } from './state/ProjectSessionContext.js';
import { ToastProvider } from './components/common/Toast.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ProjectSessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ProjectSessionProvider>
    </ErrorBoundary>
  </StrictMode>
);
