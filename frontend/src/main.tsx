import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { App } from './App';
import './styles/styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

/** Application entry point: mounts the router + auth provider into #root. */
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);