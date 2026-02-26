import { Navigate, Outlet } from 'react-router-dom';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAdminToken, getStoredAdmin } from '@/lib/api/adminAuth';

export default function AdminLayout() {
  const hasToken = !!getAdminToken();
  const user = getStoredAdmin();

  if (!hasToken || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
