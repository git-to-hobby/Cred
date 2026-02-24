const ADMIN_TOKEN_KEY = 'credflow_admin_token';
const ADMIN_USER_KEY = 'credflow_admin';

export interface StoredAdminUser {
  bankerId: string;
  name: string;
  role: string;
  bankId: string;
  bankName: string;
  bankCode?: string;
  isPlatformAdmin?: boolean;
}

export function isPlatformAdminUser(user: StoredAdminUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  return user.bankId === 'BANK_CREDFLOW' || user.role.toLowerCase().includes('platform admin');
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getStoredAdmin(): StoredAdminUser | null {
  const raw = sessionStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAdminUser;
  } catch {
    return null;
  }
}

export function saveAdminSession(token: string, user: StoredAdminUser) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
  const legacy = sessionStorage.getItem('trustkaro_admin');
  if (legacy) sessionStorage.removeItem('trustkaro_admin');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('credflow-admin-session-cleared'));
  }
}

export function adminAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function handleAdminUnauthorized(status: number) {
  if (status === 401 && typeof window !== 'undefined') {
    clearAdminSession();
    const onLoginPage = window.location.pathname.startsWith('/admin/login');
    if (!onLoginPage) {
      window.location.href = '/admin/login';
    }
  }
}
