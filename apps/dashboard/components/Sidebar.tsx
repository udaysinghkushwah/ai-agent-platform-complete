'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  Sparkles,
  Target,
  Bell,
  FileText,
  Key,
  Webhook,
  Users,
  CreditCard,
  Rocket,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  category?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview Dashboard', icon: LayoutDashboard, category: 'OBSERVABILITY' },
  { href: '/prompts/playground', label: 'Prompt Sandbox', icon: Sparkles, category: 'OBSERVABILITY' },
  { href: '/traces', label: 'Live Traces Stream', icon: Zap, category: 'OBSERVABILITY' },
  { href: '/evaluations', label: 'Evaluations & RAG', icon: Target, category: 'OBSERVABILITY' },
  { href: '/alerts', label: 'Alert Rules & HITL', icon: Bell, category: 'OBSERVABILITY' },

  { href: '/audit-log', label: 'Audit Trail', icon: FileText, category: 'GOVERNANCE' },
  { href: '/settings/api-keys', label: 'API Key Management', icon: Key, category: 'GOVERNANCE' },
  { href: '/settings/integrations', label: 'Slack & Webhooks', icon: Webhook, category: 'GOVERNANCE' },
  { href: '/settings/team', label: 'Team & RBAC', icon: Users, category: 'GOVERNANCE' },
  { href: '/settings/usage', label: 'Usage Billing', icon: CreditCard, category: 'GOVERNANCE' },

  { href: '/onboarding', label: 'Connect Agent SDK', icon: Rocket, category: 'INTEGRATION' },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsExpanded(false);
      } else {
        setIsExpanded(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside
      className={`border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between py-4 transition-all duration-300 ease-in-out shrink-0 z-20 ${
        isExpanded ? 'w-64 px-4' : 'w-16 px-2.5 items-center'
      }`}
    >
      {/* Top Header & Flip Toggle */}
      <div className="space-y-4 w-full">
        <div className={`flex items-center ${isExpanded ? 'justify-between px-2' : 'justify-center'}`}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
              2Ai
            </div>
            {isExpanded && (
              <div>
                <p className="text-xs font-black text-white tracking-tight">AI Agent Platform</p>
                <p className="text-[10px] font-mono text-cyan-400">Control Plane v1.0</p>
              </div>
            )}
          </Link>

          {/* Flip Menu Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Menu (Flip)' : 'Expand Menu (Flip)'}
            className="p-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700 transition"
          >
            {isExpanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        {/* Divider */}
        <div className="border-b border-slate-800/80 w-full" />

        {/* Navigation Items */}
        <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV_ITEMS.map((item, index) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const showCategoryHeader =
              isExpanded && (index === 0 || item.category !== NAV_ITEMS[index - 1].category);

            return (
              <div key={item.href}>
                {showCategoryHeader && (
                  <div className="pt-3 pb-1.5 px-3 text-[10px] font-mono font-bold text-slate-500 tracking-wider">
                    {item.category}
                  </div>
                )}
                <Link
                  href={item.href}
                  title={!isExpanded ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl transition-all duration-200 ${
                    isExpanded ? 'px-3.5 py-2.5 text-xs font-bold' : 'h-10 w-10 justify-center'
                  } ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'}`} />
                  {isExpanded && <span className="truncate">{item.label}</span>}

                  {!isExpanded && (
                    <span className="absolute left-14 scale-0 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-xl group-hover:scale-100 transition whitespace-nowrap z-50 border border-slate-800 pointer-events-none">
                      {item.label}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Flip Menu Indicator */}
      <div className="pt-4 border-t border-slate-800/80 w-full">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white hover:border-slate-700 transition`}
        >
          {isExpanded ? (
            <>
              <ChevronLeft className="h-4 w-4 text-cyan-400" />
              <span>Collapse Sidebar</span>
            </>
          ) : (
            <ChevronRight className="h-4 w-4 text-cyan-400" />
          )}
        </button>
      </div>
    </aside>
  );
}
