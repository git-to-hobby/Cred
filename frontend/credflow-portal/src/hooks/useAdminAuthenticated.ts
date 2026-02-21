import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { getAdminToken, getStoredAdmin } from '@/lib/api/adminAuth';

/** Use for admin React Query calls — waits until login session is ready. */
export function useAdminAuthenticated() {
  const { admin } = useAdminAuth();
  const hasToken = !!getAdminToken();
  const storedUser = getStoredAdmin();
  const queryEnabled = hasToken && !!storedUser;
  return { isAuthenticated: queryEnabled, admin: storedUser ?? admin, queryEnabled };
}
