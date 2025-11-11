import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { initializeAccentColor } from "@/lib/accentColorUtils";
import { Toaster } from "@/components/ui/toaster";

// 初始化强调色
initializeAccentColor().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
