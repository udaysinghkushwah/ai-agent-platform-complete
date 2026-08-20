'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { orgs, projects as projectsApi } from './api';

interface SessionUser {
  id: string;
  email: string;
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  organizationId: string | null;
  projectId: string | null;
  ready: boolean;
}

interface SessionContextValue extends SessionState {
  setSession: (token: string, user: SessionUser) => void;
  setOrganization: (organizationId: string | null) => void;
  setProject: (projectId: string | null) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEYS = {
  token: 'aap_token',
  user: 'aap_user',
  organizationId: 'aap_org_id',
  projectId: 'aap_project_id',
} as const;

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({
    token: null,
    user: null,
    organizationId: null,
    projectId: null,
    ready: false,
  });

  useEffect(() => {
    let token = window.localStorage.getItem(STORAGE_KEYS.token);
    let userRaw = window.localStorage.getItem(STORAGE_KEYS.user);
    let organizationId = window.localStorage.getItem(STORAGE_KEYS.organizationId);
    let projectId = window.localStorage.getItem(STORAGE_KEYS.projectId);

    const initializeSession = (authToken: string, authUser: SessionUser) => {
      orgs
        .list()
        .then((orgList) => {
          if (orgList.length > 0) {
            const selectedOrgId = organizationId || orgList[0].id;
            window.localStorage.setItem(STORAGE_KEYS.organizationId, selectedOrgId);

            projectsApi
              .listForOrg(selectedOrgId)
              .then((projList) => {
                const selectedProjId = projectId || (projList.length > 0 ? projList[0].id : null);
                if (selectedProjId) {
                  window.localStorage.setItem(STORAGE_KEYS.projectId, selectedProjId);
                }
                setState({
                  token: authToken,
                  user: authUser,
                  organizationId: selectedOrgId,
                  projectId: selectedProjId,
                  ready: true,
                });
              })
              .catch(() => {
                setState({
                  token: authToken,
                  user: authUser,
                  organizationId: selectedOrgId,
                  projectId,
                  ready: true,
                });
              });
          } else {
            setState({
              token: authToken,
              user: authUser,
              organizationId: null,
              projectId: null,
              ready: true,
            });
          }
        })
        .catch(() => {
          setState({
            token: authToken,
            user: authUser,
            organizationId,
            projectId,
            ready: true,
          });
        });
    };

    if (!token) {
      fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dev@example.com', password: 'devpassword123' }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.accessToken) {
            window.localStorage.setItem(STORAGE_KEYS.token, data.accessToken);
            window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
            initializeSession(data.accessToken, data.user);
          } else {
            setState((s) => ({ ...s, ready: true }));
          }
        })
        .catch(() => setState((s) => ({ ...s, ready: true })));
    } else {
      initializeSession(token, userRaw ? JSON.parse(userRaw) : { id: 'dev', email: 'dev@example.com' });
    }
  }, []);

  function setSession(token: string, user: SessionUser) {
    window.localStorage.setItem(STORAGE_KEYS.token, token);
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    setState((s) => ({ ...s, token, user }));
  }

  function setOrganization(organizationId: string | null) {
    if (organizationId) window.localStorage.setItem(STORAGE_KEYS.organizationId, organizationId);
    else window.localStorage.removeItem(STORAGE_KEYS.organizationId);
    window.localStorage.removeItem(STORAGE_KEYS.projectId);
    setState((s) => ({ ...s, organizationId, projectId: null }));
  }

  function setProject(projectId: string | null) {
    if (projectId) window.localStorage.setItem(STORAGE_KEYS.projectId, projectId);
    else window.localStorage.removeItem(STORAGE_KEYS.projectId);
    setState((s) => ({ ...s, projectId }));
  }

  function logout() {
    Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
    setState({ token: null, user: null, organizationId: null, projectId: null, ready: true });
    router.push('/login');
  }

  return (
    <SessionContext.Provider value={{ ...state, setSession, setOrganization, setProject, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
