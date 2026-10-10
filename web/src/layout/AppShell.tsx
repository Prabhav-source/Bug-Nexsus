import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Bug, Columns3, FolderKanban, Zap, Users,
  BarChart3, Activity, Settings, Search, Bell, LogOut, ChevronDown, Hexagon, Menu, Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Avatar } from '../components/ui';
import CommandPalette from './CommandPalette';

const NAV_MAIN = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/issues', label: 'Issues', icon: Bug },
  { to: '/board', label: 'Board', icon: Columns3 },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/sprints', label: 'Sprints', icon: Zap },
];

const NAV_INSIGHTS = [
  { to: '/developers', label: 'Developers', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/activity', label: 'Activity', icon: Activity },
];

function NavItem({ to, label, icon: Icon, end, onNavigate }: { to: string; label: string; icon: React.ElementType; end?: boolean; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13.5px] font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary/[0.09] text-text-primary'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full transition-all duration-200 ${
              isActive ? 'bg-primary shadow-[0_0_8px_rgba(255,23,68,0.65)]' : 'bg-transparent group-hover:bg-border'
            }`}
          />
          <Icon
            size={17}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'}
          />
          {label}
          {isActive && (
            <motion.div
              layoutId="nav-glow"
              className="absolute inset-0 rounded-lg -z-10"
              style={{ boxShadow: 'inset 0 0 14px rgba(255, 23, 68, 0.12)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ mobileOpen, onNavigate }: { mobileOpen?: boolean; onNavigate?: () => void }) {
  const { activeWorkspace, workspaces, setActiveWorkspace, logout, user } = useAuth();
  const [wsOpen, setWsOpen] = useState(false);

  return (
    <aside className={`${mobileOpen ? 'flex' : 'hidden'} lg:flex w-[248px] shrink-0 border-r border-border bg-sidebar flex-col h-screen sticky top-0 z-30`}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border-subtle shrink-0">
          <span className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-surface-elevated border border-border-accent shadow-[0_0_14px_rgba(255,23,68,0.25)]">
          <Hexagon size={18} strokeWidth={2.4} className="text-primary" fill="currentColor" fillOpacity={0.18} />
        </span>
        <div className="leading-tight">
          <div className="font-extrabold tracking-tight text-text-primary text-[14.5px]">BUGNEXUS</div>
          <div className="text-[9px] font-mono text-primary tracking-[0.22em]">FIND · FIX · SHIP</div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-3 relative shrink-0">
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="w-full flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-[9px] hover:bg-surface-hover hover:border-border-accent transition-colors duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(255,23,68,0.5)] shrink-0" />
            <span className="text-[13px] font-medium text-text-primary truncate">{activeWorkspace?.name ?? 'Workspace'}</span>
          </div>
          <ChevronDown size={14} className={`text-text-muted transition-transform duration-200 shrink-0 ${wsOpen ? 'rotate-180' : ''}`} />
        </button>
        {wsOpen && (
          <div className="absolute z-30 left-3 right-3 mt-1.5 rounded-xl border border-border bg-surface-elevated shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in py-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { setActiveWorkspace(ws); setWsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${ws.id === activeWorkspace?.id ? 'text-primary bg-primary/[0.08]' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
              >
                {ws.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-semibold font-mono uppercase tracking-[0.14em] text-text-muted/80">Workspace</div>
          <div className="space-y-0.5">
            {NAV_MAIN.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-semibold font-mono uppercase tracking-[0.14em] text-text-muted/80">Insights</div>
          <div className="space-y-0.5">
            {NAV_INSIGHTS.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-border-subtle p-3 space-y-0.5 shrink-0">
        <NavItem to="/settings" label="Settings" icon={Settings} onNavigate={onNavigate} />
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-hover/70 transition-colors mt-1">
          <Avatar name={user?.name} color={user?.color} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-text-primary truncate">{user?.name}</div>
            <div className="text-[10px] text-text-muted truncate">{user?.email}</div>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="text-text-muted hover:text-danger transition-colors p-1 rounded-md hover:bg-danger/10">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: string; type: string; message: string; read: boolean }[]>([]);
  const [unread, setUnread] = useState(0);

  const loadNotifs = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifs(res.data.data);
      const c = await api.get('/notifications/unread-count');
      setUnread(c.data.data.count);
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadNotifs(); }, []);

  return (
    <header className="h-15 border-b border-border-subtle bg-background/85 backdrop-blur-md flex items-center gap-2.5 px-4 sm:px-6 sticky top-0 z-20 h-16">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="lg:hidden rounded-lg p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors duration-150"
      >
        <Menu size={18} />
      </button>
       {/* Global search */}
       <button
         onClick={onSearch}
         className="hidden sm:flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 h-9 text-[13px] text-text-secondary hover:border-primary/50 hover:text-text-primary transition-colors duration-200 w-64 xl:w-80 focus:outline-none focus:ring-2 focus:ring-primary/30"
       >
         <Search size={15} className="shrink-0 text-text-muted" />
         <span className="flex-1 text-left truncate">Search issues, projects, people…</span>
         <kbd className="text-[10px] font-mono text-text-muted border border-border rounded-md px-1.5 py-0.5 bg-surface-elevated shrink-0">⌘K</kbd>
       </button>
      <button
        onClick={onSearch}
        aria-label="Search"
        className="sm:hidden rounded-lg p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
      >
        <Search size={18} />
      </button>

      <div className="flex-1" />

      {/* Create issue */}
      <NavLink
        to="/issues/new"
        className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-[13px] font-semibold hover:bg-primary-hover active:scale-[0.98] shadow-[0_0_16px_rgba(255,23,68,0.45)] hover:shadow-[0_0_22px_rgba(255,23,68,0.55)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <Plus size={15} strokeWidth={2.5} />
        New Issue
      </NavLink>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) loadNotifs(); }}
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors duration-150"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface-elevated shadow-[0_12px_40px_rgba(0,0,0,0.6)] animate-fade-in z-30 overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle text-[13px] font-semibold text-text-primary">Notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-text-muted">You're all caught up.</div>
              )}
              {notifs.slice(0, 10).map((n) => (
                <div key={n.id} className={`px-4 py-2.5 border-b border-border-subtle text-xs ${n.read ? 'text-text-muted' : 'text-text-primary'}`}>
                  {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5 align-middle" />}
                  <span className="font-medium">{n.message}</span>
                  <div className="text-[10px] text-text-muted mt-0.5 font-mono">{n.type}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-border-subtle hidden sm:block" />
      <Avatar name={user?.name} color={user?.color} />
    </header>
  );
}

export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileNav(false); }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile drawer backdrop */}
      {mobileNav && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className={`fixed inset-y-0 left-0 z-30 lg:static lg:z-auto ${mobileNav ? 'block' : 'hidden lg:block'}`}>
        <Sidebar mobileOpen={mobileNav} onNavigate={() => setMobileNav(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav onMenu={() => setMobileNav(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 overflow-x-hidden">
          <div className="max-w-[1200px] mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.3, 0, 0.2, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <PaletteTrigger onOpen={() => setPaletteOpen(true)} />
    </div>
  );
}

function PaletteTrigger({ onOpen }: { onOpen: () => void }) {
  // Global keyboard shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
  return null;
}
