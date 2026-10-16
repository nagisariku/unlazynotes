import { useState } from 'react';
import {
  FileText,
  Bookmark,
  Settings,
  LogOut,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
    role?: string;
  };
  subscriptionPlan?: string;
}

export default function Sidebar({ currentPath, user, subscriptionPlan = 'standard' }: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'All Notes', href: '/dashboard', icon: FileText },
    { label: 'Bookmarks', href: '/dashboard/bookmarks', icon: Bookmark },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  if (user.role === 'admin') {
    navItems.push({ label: 'Admin Panel', href: '/admin', icon: ShieldAlert });
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  const isPro = subscriptionPlan === 'pro';

  return (
    <>
      {/* ============================================================ */}
      {/* 1. MOBILE TOP HEADER (< md)                                 */}
      {/* ============================================================ */}
      <header className="md:hidden sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-sm">
            U
          </div>
          <span className="font-bold tracking-tight text-zinc-100 text-sm">UnlazyNotes</span>
        </a>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isPro
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {isPro ? 'Pro' : 'Free'}
          </span>

          {!isPro && (
            <a
              href="/dashboard/settings#upgrade"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Upgrade to Pro</span>
            </a>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. MOBILE SLIDE-OVER DRAWER (< md)                          */}
      {/* ============================================================ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 right-0 w-[85%] max-w-xs bg-zinc-950 border-l border-zinc-800 p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                    U
                  </div>
                  <div>
                    <span className="font-bold tracking-tight text-zinc-100 text-sm block">UnlazyNotes</span>
                    <span className="text-[10px] text-zinc-500">Navigation Menu</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Nav List */}
              <nav className="space-y-1 mb-5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPath === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>

              {/* Upgrade CTA in Drawer */}
              {!isPro && (
                <div className="mb-4">
                  <a
                    href="/dashboard/settings#upgrade"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/20 hover:bg-indigo-950/40 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Upgrade ke Pro</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      Catatan tanpa batas &amp; AI <code className="text-indigo-300">/ask</code> bot.
                    </p>
                  </a>
                </div>
              )}

              {/* Telegram Bot Banner */}
              <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-xs">
                <p className="text-zinc-400 mb-1.5 font-medium">Quick Capture Bot:</p>
                <a
                  href="https://t.me/unlazynotes_bot"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <span>@unlazynotes_bot</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* User Profile & Logout */}
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 uppercase overflow-hidden">
                  {user.image ? (
                    <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user.name || user.email)[0]
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-zinc-200 truncate">{user.name || 'User'}</p>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isPro
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {isPro ? 'Pro' : 'Free'}
                    </span>
                    {!isPro && (
                      <a
                        href="/dashboard/settings#upgrade"
                        onClick={() => setMobileMenuOpen(false)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Upgrade to Pro</span>
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Keluar"
                className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MOBILE BOTTOM NAVIGATION BAR (< md)                       */}
      {/* ============================================================ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-3 py-2 flex items-center justify-around safe-area-bottom shadow-xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-400 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* ============================================================ */}
      {/* 4. DESKTOP PERMANENT SIDEBAR (>= md)                        */}
      {/* ============================================================ */}
      <aside className="hidden md:flex w-64 border-r border-zinc-800 bg-zinc-950 flex-col h-screen sticky top-0 shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
              U
            </div>
            <span className="font-bold tracking-tight text-zinc-100">UnlazyNotes</span>
          </a>
        </div>

        {/* Nav List */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Telegram Bot Link Quick Banner */}
        <div className="px-4 py-3 mx-3 mb-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-xs">
          <p className="text-zinc-400 mb-1.5 font-medium">Quick Capture Bot:</p>
          <a
            href="https://t.me/unlazynotes_bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            <span>@unlazynotes_bot</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 uppercase overflow-hidden">
              {user.image ? (
                <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (user.name || user.email)[0]
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-zinc-200 truncate max-w-[95px]">
                  {user.name || 'User'}
                </p>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                    isPro
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {isPro ? 'Pro' : 'Free'}
                </span>
              </div>
              {!isPro ? (
                <a
                  href="/dashboard/settings#upgrade"
                  className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold transition-all"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Upgrade to Pro</span>
                </a>
              ) : (
                <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
