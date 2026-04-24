import type { ApiUser } from "./types";

export const storageKey = "flowforge_blogger_session";

export type AppSession = {
  token: string;
  user: ApiUser;
};

export function readSession(): AppSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AppSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeSession(session: AppSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(storageKey);
}
