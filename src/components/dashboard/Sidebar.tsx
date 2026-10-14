import { FileText, Bookmark, Settings, LogOut, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';

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

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand */}
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-base">
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

      {/* Pro Upgrade CTA Banner if not Pro */}
      {subscriptionPlan !== 'pro' && (
        <div className="px-3 mb-2">
          <a
            href="/dashboard/settings#upgrade"
            className="block p-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 hover:bg-indigo-950/40 text-xs transition-colors group"
          >
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Upgrade ke Pro</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Unlimited catatan &amp; AI <code className="text-indigo-300">/ask</code> bot.
            </p>
          </a>
        </div>
      )}

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
      <div className="p-3 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 uppercase overflow-hidden">
            {user.image ? (
              <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (user.name || user.email)[0]
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-200 truncate">
              {user.name || 'User'}
            </p>
            <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign Out"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
