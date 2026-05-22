'use client';

import { create } from 'zustand';

import { apiClient } from '@/lib/api-client';
import type { LoginResponse, MeResponse, RegisterRequest, RegisterResponse } from '@/types/auth';
import { useProjectStore } from '@/stores/project-store';
import { useAutopilotStore } from '@/stores/autopilot-store';

const TOKEN_KEY = 'ragstudio.accessToken';
const USER_ID_KEY = 'ragstudio.userId';

function readStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(USER_ID_KEY)?.trim() || null;
}

function writeStoredUserId(userId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!userId) window.localStorage.removeItem(USER_ID_KEY);
  else window.localStorage.setItem(USER_ID_KEY, userId);
}

export type AuthProfile = {
  userId: string;
  email: string;
  name: string;
  role: string;
  subscriptionTier: string;
  emailVerified: boolean;
};

type AuthState = {
  accessToken: string | null;
  profile: AuthProfile | null;
  isLoadingProfile: boolean;
  lastError: string | null;
  isAuthenticated: boolean;
  hasInitialized: boolean;
  syncProjectsInBackground: () => Promise<void>;

  initFromToken: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
};

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY)?.trim() || null;
}

function writeToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (!token) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, token);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: readToken(),
  profile: null,
  isLoadingProfile: false,
  lastError: null,
  isAuthenticated: false,
  hasInitialized: false,

  // Keep project sync non-blocking so auth-gated route transitions feel immediate.
  syncProjectsInBackground: async () => {
    try {
      await useProjectStore.getState().syncFromServer();
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) });
    }
  },

  initFromToken: async () => {
    const token = readToken();
    set({ accessToken: token, lastError: null });
    if (!token) {
      set({ profile: null, isAuthenticated: false, hasInitialized: true });
      return;
    }

    // Unblock route transitions immediately; validate the token in the background.
    set({ hasInitialized: true, isAuthenticated: true });
    const previousUserId = readStoredUserId();

    try {
      await get().loadMe();
    } catch {
      return;
    }

    const nextUserId = get().profile?.userId ?? null;
    if (previousUserId && nextUserId && previousUserId !== nextUserId) {
      useProjectStore.getState().clearProjects();
      useAutopilotStore.getState().resetSession();
      useAutopilotStore.getState().clearBuildHistory();
    }
    writeStoredUserId(nextUserId);

    if (get().isAuthenticated) {
      void get().syncProjectsInBackground();
    }
  },

  login: async (email, password) => {
    set({ lastError: null });
    const res = await apiClient.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });
    writeToken(res.access_token);

    const profile: AuthProfile = {
      userId: res.user_id,
      email: res.email,
      name: res.name,
      role: res.role,
      subscriptionTier: res.subscription_tier,
      emailVerified: res.email_verified,
    };

    set({
      accessToken: res.access_token,
      profile,
      isAuthenticated: true,
      hasInitialized: true,
    });
    writeStoredUserId(res.user_id);

    // Sync the user-owned workspace.
    useProjectStore.getState().clearProjects();
    void get().syncProjectsInBackground();
  },

  register: async (input) => {
    set({ lastError: null });
    return apiClient.post<RegisterResponse>('/api/auth/register', input);
  },

  loadMe: async () => {
    set({ isLoadingProfile: true, lastError: null });
    try {
      const res = await apiClient.get<MeResponse>('/api/auth/me');
      const profile: AuthProfile = {
        userId: res.user_id,
        email: res.email,
        name: res.name,
        role: res.role,
        subscriptionTier: res.subscription_tier,
        emailVerified: res.email_verified,
      };
      set({ profile, isAuthenticated: true });
    } catch (e) {
      // If the token is invalid/expired, clear it and treat as logged out.
      writeToken(null);
      set({ profile: null, isAuthenticated: false, accessToken: null });
      set({ lastError: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ isLoadingProfile: false });
    }
  },

  logout: async () => {
    set({ lastError: null });
    try {
      // Best-effort revoke; server-side validation is enforced.
      await apiClient.post('/api/auth/logout', {});
    } catch {
      // ignore: logout should still clear client token
    } finally {
      writeToken(null);
      writeStoredUserId(null);
      set({ accessToken: null, profile: null, isAuthenticated: false, hasInitialized: true });
      useProjectStore.getState().clearProjects();
      useAutopilotStore.getState().resetSession();
      useAutopilotStore.getState().clearBuildHistory();
    }
  },
}));

