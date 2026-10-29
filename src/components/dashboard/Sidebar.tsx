import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Bookmark,
  Wallet,
  ShieldAlert,
  Shield,
  Bot,
  ExternalLink,
  Menu,
  X,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import { CommandTag } from '../ui';
import UpgradeModal from './UpgradeModal';
import { toast } from 'sonner';

interface SidebarProps {
  currentPath: string;
  user: {
    id?: string;
    name?: string | null;
    email: string;
    image?: string | null;
    role?: string;
  };
  subscriptionPlan?: string;
  isTelegramConnected?: boolean;
  botUsername?: string;
  rawApiKey?: string | null;
}

export default function Sidebar({
  currentPath,
  user,
  subscriptionPlan = 'free',
  isTelegramConnected = false,
  botUsername = 'unlazynotes_bot',
  rawApiKey = null,
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile drawer or connect modal is open
  useEffect(() => {
    if (mobileMenuOpen || isConnectModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileMenuOpen, isConnectModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isConnectModalOpen) {
        setIsConnectModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnectModalOpen]);

  // Wireframe Menu Items:
  // 1. Workspace
  // 2. To Do & Schedule
  // 3. Bookmarks
  // 4. Vault & Credentials
  // 5. Admin Panel (Conditional)
  const navItems = [
    { label: 'Workspace', href: '/dashboard', icon: LayoutDashboard },
    { label: 'To Do', href: '/dashboard/todo', icon: CheckSquare },
    { label: 'Schedule', href: '/dashboard/schedule', icon: Calendar },
    { label: 'Bookmarks', href: '/dashboard/bookmarks', icon: Bookmark },
    { label: 'Finance', href: '/dashboard/finance', icon: Wallet },
    { label: 'Vault & Credentials', href: '/dashboard/vault', icon: ShieldAlert },
  ];

  if (user.role === 'admin') {
    navItems.push({ label: 'Admin Panel', href: '/admin', icon: Shield });
  }

  const isPro = subscriptionPlan === 'pro';

  const handleCopyLoginCommand = async () => {
    if (!rawApiKey) {
      toast.info('API Key dapat dilihat di menu Settings');
      return;
    }
    const cmd = `/login ${rawApiKey}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedKey(true);
      toast.success('Perintah login berhasil disalin ke clipboard');
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error('Gagal menyalin perintah');
    }
  };

  const handleBotButtonClick = () => {
    if (isTelegramConnected) {
      window.open(`https://t.me/${botUsername}`, '_blank', 'noopener,noreferrer');
    } else {
      setIsConnectModalOpen(true);
    }
  };

  const handleProfileClick = () => {
    window.location.href = '/dashboard/settings';
  };

  return (
    <>
      {/* =========================================================================
          1. MOBILE TOP HEADER (< md)
          ========================================================================= */}
      <header className="md:hidden shrink-0 z-40 bg-canvas px-4 py-2 flex items-center justify-between text-ink">
        <a href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm select-none">
            U
          </div>
          <span className="font-display font-medium tracking-tight text-ink text-[18px]">UnlazyNotes</span>
        </a>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1 text-ink hover:text-charcoal cursor-pointer flex items-center justify-center"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-7 h-7" />
        </button>
      </header>

      {/* =========================================================================
          2. MOBILE SLIDE-OVER DRAWER (< md)
          ========================================================================= */}
      {mobileMenuOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9998] md:hidden"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="fixed inset-0 bg-black/75 select-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div
            className="fixed inset-y-0 right-0 w-[85%] max-w-xs h-full min-h-[100dvh] bg-canvas border-l border-hairline p-5 flex flex-col justify-between text-ink z-[9999]"
            style={{ minHeight: '100dvh' }}
          >
            {/* Top Part: App Logo, Enlarge Close Button & Nav Links */}
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm select-none">
                    U
                  </div>
                  <span className="font-display font-medium tracking-tight text-ink text-[18px] block leading-none">
                    UnlazyNotes
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-body hover:text-ink hover:bg-surface-soft rounded-full cursor-pointer flex items-center justify-center"
                  aria-label="Tutup menu"
                >
                  <X className="w-7 h-7" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1 overflow-y-auto flex-1 flex flex-col items-start">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPath === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-full text-body-sm font-medium transition-colors ${
                        isActive
                          ? 'w-fit bg-surface-soft text-ink font-semibold'
                          : 'w-full text-body hover:text-ink hover:bg-surface-soft'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Part: Connect Bot Button & Profile Card (identical to desktop sidebar, no divider) */}
            <div className="pt-2 space-y-2 shrink-0">
              {/* Bot Button: Positioned before profile user like desktop */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleBotButtonClick();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-hairline bg-surface-soft hover:bg-canvas text-body-sm font-medium text-ink cursor-pointer"
              >
                <Bot className="w-4 h-4 text-ink shrink-0" />
                <span className="truncate">
                  {isTelegramConnected ? 'Open Telegram Bot' : 'Connect Bot'}
                </span>
              </button>

              {/* Profile Area & Separate Upgrade Button (Two separate components, no arrow right) */}
              <div className="flex items-center gap-2 w-full">
                {/* Component 1: Profile (Avatar + User Name + PRO badge if pro) */}
                <div
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleProfileClick();
                  }}
                  role="button"
                  tabIndex={0}
                  className="flex-1 min-w-0 h-14 p-2 rounded-xl hover:bg-surface-soft cursor-pointer flex items-center gap-3 text-left transition-colors"
                  title="Klik untuk ke Pengaturan Profil"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-soft border border-hairline flex items-center justify-center text-sm font-bold text-ink shrink-0 uppercase overflow-hidden">
                    {user.image ? (
                      <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (user.name || user.email)[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <span className="text-body-sm font-semibold text-ink truncate leading-tight block">
                      {user.name || 'User'}
                    </span>
                    <div className="mt-1 flex items-center">
                      {isPro ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-ink text-canvas select-none shadow-xs">
                          PRO
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-surface-soft border border-hairline text-body select-none">
                          FREE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Component 2: Upgrade Button (Standard button height, white background matching profile, hover:bg-surface-soft, no border) */}
                {!isPro && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsUpgradeModalOpen(true);
                    }}
                    className="h-9 px-3.5 rounded-full bg-canvas hover:bg-surface-soft text-ink text-caption-sm font-semibold cursor-pointer transition-colors shrink-0 inline-flex items-center justify-center select-none"
                    title="Upgrade ke Pro"
                  >
                    <span>Upgrade</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          3. DESKTOP PERMANENT SIDEBAR (>= md)
          Wireframe Architecture:
          - Top Logo: UnlazyNotes
          - Menu Items: Workspace, To Do & Schedule, Bookmarks, Vault & Credentials, Admin Panel
          - Button: Connect/Open bot
          - Profile Component: Avatar, Name, Badge, Upgrade Button, Click -> Settings
          ========================================================================= */}
      <aside className="hidden md:flex w-64 border-r border-hairline bg-canvas flex-col h-screen sticky top-0 shrink-0 text-ink justify-between">
        {/* Top Part: Logo & Menu Items */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* App Logo */}
          <div className="p-5 flex items-center justify-between">
            <a href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-base select-none">
                U
              </div>
              <span className="font-display font-medium tracking-tight text-ink text-[21px] block leading-none">
                UnlazyNotes
              </span>
            </a>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-full text-body-sm font-medium transition-colors ${ isActive ? 'bg-surface-soft text-ink font-semibold' : 'text-body hover:text-ink hover:bg-surface-soft' }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Bottom Part: Bot Button & Profile Card */}
        <div className="p-3 space-y-2 bg-canvas shrink-0">
          {/* Wireframe Button: Connect / Open bot */}
          <button
            onClick={handleBotButtonClick}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-hairline bg-surface-soft hover:bg-canvas text-body-sm font-medium text-ink cursor-pointer"
          >
            <Bot className="w-4 h-4 text-ink shrink-0" />
            <span className="truncate">
              {isTelegramConnected ? 'Open Telegram Bot' : 'Connect Bot'}
            </span>
          </button>

          {/* Profile Card:
              - Avatar circle (w-10 h-10)
              - Name & Badge
              - No box by default, appears on hover
              - Click opens settings
          */}
          {/* Profile Card & Separate Upgrade Button (Two separate components) */}
          <div className="flex items-center gap-2 w-full">
            {/* Component 1: Profile (Avatar + User Name + PRO badge if pro) */}
            <div
              onClick={handleProfileClick}
              role="button"
              tabIndex={0}
              title="Buka Pengaturan Akun"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleProfileClick();
                }
              }}
              className="flex-1 min-w-0 h-14 p-2 rounded-xl hover:bg-surface-soft cursor-pointer flex items-center gap-3 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-surface-soft border border-hairline flex items-center justify-center text-sm font-bold text-ink shrink-0 uppercase overflow-hidden">
                {user.image ? (
                  <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user.name || user.email)[0]
                )}
              </div>

              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span className="text-body-sm font-semibold text-ink truncate leading-tight block">
                  {user.name || 'User'}
                </span>
                <div className="mt-1 flex items-center">
                  {isPro ? (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-ink text-canvas select-none shadow-xs">
                      PRO
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-surface-soft border border-hairline text-body select-none">
                      FREE
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Component 2: Upgrade Button (Standard button height, white background matching profile, hover:bg-surface-soft, no border) */}
            {!isPro && (
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="h-9 px-3.5 rounded-full bg-canvas hover:bg-surface-soft text-ink text-caption-sm font-semibold cursor-pointer transition-colors shrink-0 inline-flex items-center justify-center select-none"
                title="Upgrade ke Pro"
              >
                <span>Upgrade</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* =========================================================================
          5. MODALS: UPGRADE MODAL & CONNECT TELEGRAM BOT MODAL
          ========================================================================= */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {/* Connect Bot Instructions Modal */}
      {isConnectModalOpen && mounted && typeof document !== 'undefined' && createPortal(
        <>
          {/* Full-screen Backdrop covering 100% viewport */}
          <div
            className="fixed inset-0 z-[9998] bg-black/75 select-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            aria-hidden="true"
          />

          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 pointer-events-none select-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-canvas p-6 text-ink space-y-5 pointer-events-auto shadow-2xl">
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="absolute top-5 right-5 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-surface-soft cursor-pointer transition-colors !border-0"
                title="Tutup (Esc)"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1.5 pr-8 select-none">
                <div className="inline-flex items-center gap-1.5">
                  <CommandTag>
                    <Send className="w-3 h-3 inline mr-1" />
                    Telegram Quick Capture
                  </CommandTag>
                </div>
                <h2 className="text-heading-lg text-ink font-semibold">
                  Hubungkan Akun Telegram
                </h2>
                <p className="text-body-sm text-body">
                  Kirim catatan, audio, tautan, atau tugas langsung dari obrolan Telegram ke dashboard Anda.
                </p>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-surface-soft text-body-sm select-none">
                <p className="font-semibold text-ink text-caption-sm uppercase tracking-wide">
                  Langkah Cepat:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-body-sm text-ink leading-relaxed">
                  <li>
                    Buka bot resmi di Telegram:{' '}
                    <a
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-ink underline"
                    >
                      @{botUsername}
                    </a>
                  </li>
                  <li>
                    Kirim perintah berikut ke bot:
                    <div className="mt-1.5 flex items-center gap-2 p-2 rounded-full bg-canvas font-mono text-caption-sm">
                      <span className="truncate flex-1 text-ink px-1">
                        {rawApiKey ? `/login ${rawApiKey}` : '/login <API_KEY_ANDA>'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyLoginCommand}
                        className="p-1 rounded-full text-body hover:text-ink hover:bg-surface-soft cursor-pointer shrink-0 transition-colors !border-0"
                        title="Salin Perintah"
                        aria-label="Salin perintah"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </li>
                  <li>Selesai! Akun Telegram Anda akan langsung tersinkronisasi.</li>
                </ol>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 select-none">
                <a
                  href="/dashboard/settings"
                  className="text-caption-sm text-body hover:text-ink underline"
                >
                  Lihat API Key di Pengaturan
                </a>

                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary text-button-md cursor-pointer hover:opacity-90 active:scale-95 transition-all !border-0"
                >
                  <Bot className="w-4 h-4" />
                  <span>Buka Bot Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
