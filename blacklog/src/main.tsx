import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { App } from './App';
import { CampaignList } from './pages/CampaignList';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { db, settingsRepo } from './db';
import { CORE_TABLE_PACK } from './data/coreTables';

// seed the bundled core table pack on first run (and keep it current)
db.tablePacks.put(CORE_TABLE_PACK).catch(() => {});
settingsRepo.ensure().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<CampaignList />} />
          <Route path="c/:id" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
