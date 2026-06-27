import { Outlet, Link, useLocation } from 'react-router-dom';
import { Anchor, Settings as SettingsIcon } from 'lucide-react';

export function App() {
  const loc = useLocation();
  const onMenu = loc.pathname === '/';
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b-2 border-edge bg-ink2/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <Anchor className="text-gold group-hover:text-rust transition-colors" size={22} />
            <span className="font-title text-2xl tracking-widest text-parch leading-none">
              BLACK&nbsp;<span className="text-gold">LOG</span>
            </span>
          </Link>
          <span className="hidden sm:block text-fog text-xs uppercase tracking-[0.2em] flex-1">
            solo pirate-horror campaign cockpit
          </span>
          <Link
            to="/settings"
            className="text-fog hover:text-gold flex items-center gap-1 text-xs uppercase tracking-wider"
          >
            <SettingsIcon size={16} /> <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4">
        <Outlet />
      </main>

      <footer className="border-t-2 border-edge text-center text-fog/70 text-xs py-3 px-4">
        Black Log · a local-first solo GM engine — everything saves in this browser only.
        {onMenu && <> · <a className="text-gold/80 hover:text-gold" href="../index.html">‹ back to terminal</a></>}
      </footer>
    </div>
  );
}
