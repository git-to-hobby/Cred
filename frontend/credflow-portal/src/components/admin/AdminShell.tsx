import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Home,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { isPlatformAdminUser } from '@/lib/api/adminAuth';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const baseLinks = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/customers', label: 'Customers', icon: Users },
];

const monitorLink = { path: '/admin/monitor', label: 'Bank Monitor', icon: ShieldCheck };

export function AdminShell({ children }: { children: ReactNode }) {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const links = isPlatformAdminUser(admin)
    ? [monitorLink, ...baseLinks]
    : baseLinks;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card p-6">
        <Logo />
        <p className="mt-4 text-xs font-medium text-teal-700 uppercase tracking-wide">
          {isPlatformAdminUser(admin) ? 'Platform Admin' : 'CredFlow Admin'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{admin?.name}</p>
        <p className="text-xs font-medium text-teal-800">{admin?.bankName}</p>
        <p className="text-xs text-muted-foreground">{admin?.role}</p>

        <nav className="mt-8 space-y-1 flex-1">
          {links.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === path
                  ? 'bg-teal-700 text-white'
                  : 'text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 pt-4 border-t border-border">
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              User Portal
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden sticky top-0 z-40 border-b border-border bg-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-700" />
            <span className="font-semibold">CredFlow Admin</span>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/">Home</Link>
          </Button>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
