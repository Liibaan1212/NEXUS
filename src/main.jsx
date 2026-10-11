import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { DialogProvider } from './context/DialogContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
);
