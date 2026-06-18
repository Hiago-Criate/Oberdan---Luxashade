import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { hydrateCatalog, catalogSource } from './data/catalogStore';
import { AdminApp } from './admin/AdminApp';

function isAdminRoute(): boolean {
  const p = window.location.pathname.replace(/\/+$/, '');
  return (
    p.endsWith('/admin') ||
    window.location.hash.toLowerCase().includes('admin') ||
    new URLSearchParams(window.location.search).has('admin')
  );
}

let hydrated = false;

function BootLoading() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-5 bg-zinc-50">
      <img src="/logo-luxashade.png" alt="Luxashade" className="h-24 object-contain animate-pulse" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full w-1/2 animate-[loading_1.1s_ease-in-out_infinite] rounded-full bg-zinc-900" />
      </div>
      <style>{`@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}

function Boot() {
  const admin = isAdminRoute();
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    if (hydrated) return;
    hydrateCatalog().then(() => {
      hydrated = true;
      console.info(`[catalog] fonte: ${catalogSource()}`);
      setReady(true);
    });
  }, []);

  if (!ready) return <BootLoading />;
  return admin ? <AdminApp /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
