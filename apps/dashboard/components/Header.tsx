'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Settings,
  User,
  Sparkles,
  ChevronDown,
  Building2,
  FolderGit2,
  LogOut,
  SlidersHorizontal,
  Server,
  RefreshCw,
} from 'lucide-react';
import { useSession } from '@/lib/session';
import { orgs, projects as projectsApi, Organization, Project } from '@/lib/api';
import { useEffect } from 'react';

export function Header() {
  const { organizationId, projectId, setOrganization, setProject, user, logout } = useSession();
  const [orgList, setOrgList] = useState<Organization[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    orgs.list().then(setOrgList).catch(() => setOrgList([]));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setProjectList([]);
      return;
    }
    projectsApi
      .listForOrg(organizationId)
      .then(setProjectList)
      .catch(() => setProjectList([]));
  }, [organizationId]);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Brand Title & Status */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
            2Ai
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>AI OBSERVABILITY DASHBOARD</span>
              <span className="text-xs font-semibold text-slate-400 font-mono">| Enterprise AI Platform</span>
            </h1>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Status: ONLINE
              </span>
              <span>•</span>
              <span>June 18, 2024 - 11:45 PM</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Center Org & Project Scope Selectors */}
      <div className="hidden md:flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-cyan-400" />
          <select
            value={organizationId ?? ''}
            onChange={(e) => setOrganization(e.target.value || null)}
            className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            {orgList.map((o) => (
              <option key={o.id} value={o.id} className="bg-slate-900 text-white">
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-700">|</span>

        <div className="flex items-center gap-2">
          <FolderGit2 className="h-3.5 w-3.5 text-indigo-400" />
          <select
            value={projectId ?? ''}
            onChange={(e) => setProject(e.target.value || null)}
            disabled={!organizationId}
            className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            {projectList.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                {p.name} ({p.environment})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-700 transition"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
        </button>

        {/* Settings Gear */}
        <Link
          href="/settings/integrations"
          className="p-2 rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-700 transition"
          title="Settings & Integrations"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1.5 pr-2 hover:border-slate-700 transition"
          >
            <div className="h-7 w-7 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white">
              {user?.email ? user.email[0].toUpperCase() : 'A'}
            </div>
            <span className="text-xs font-bold text-slate-200 hidden sm:inline">{user?.email?.split('@')[0] || 'Alex R.'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-50">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-bold text-white truncate">{user?.email || 'dev@example.com'}</p>
                <p className="text-[10px] text-slate-400 font-mono">Developer Session</p>
              </div>
              <button
                onClick={logout}
                className="w-full mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
