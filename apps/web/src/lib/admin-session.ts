export const ADMIN_SESSION_KEY = "velthoryn_admin_api_key";

export function readAdminSessionKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "";
}

export function writeAdminSessionKey(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ADMIN_SESSION_KEY, value);
}

export function clearAdminSessionKey() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
