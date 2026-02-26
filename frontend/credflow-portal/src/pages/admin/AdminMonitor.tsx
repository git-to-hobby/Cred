import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserPlus,
  UserX,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getMonitorOverview,
  getMonitorBankers,
  setBankerActive,
  createBankerRequest,
  approveBanker,
  rejectBanker,
} from '@/lib/api/admin';
import { isPlatformAdminUser } from '@/lib/api/adminAuth';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminAuthenticated } from '@/hooks/useAdminAuthenticated';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

export default function AdminMonitor() {
  const { admin } = useAdminAuth();
  const { queryEnabled } = useAdminAuthenticated();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBank, setNewBank] = useState('BANK_HDFC');
  const [newRole, setNewRole] = useState('Loan Officer');
  const [issuedCreds, setIssuedCreds] = useState<{
    bankerId: string;
    password?: string | null;
    name: string;
    emailSent?: boolean;
    emailTo?: string | null;
    message?: string;
  } | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-monitor-overview'],
    queryFn: getMonitorOverview,
    enabled: queryEnabled && isPlatformAdminUser(admin),
  });

  const { data: bankers = [] } = useQuery({
    queryKey: ['admin-monitor-bankers'],
    queryFn: getMonitorBankers,
    enabled: queryEnabled && isPlatformAdminUser(admin),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ bankerId, isActive }: { bankerId: string; isActive: boolean }) =>
      setBankerActive(bankerId, isActive),
    onSuccess: (data) => {
      toast({ title: data.message || 'Updated' });
      queryClient.invalidateQueries({ queryKey: ['admin-monitor-bankers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-monitor-overview'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBankerRequest({
        name: newName.trim(),
        bankId: newBank,
        role: newRole.trim(),
        email: newEmail.trim(),
      }),
    onSuccess: () => {
      toast({ title: 'Officer registered', description: 'Approve to email login credentials' });
      setNewName('');
      setNewEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-monitor-bankers'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (bankerId: string) => approveBanker(bankerId),
    onSuccess: (data) => {
      setIssuedCreds({
        bankerId: data.bankerId,
        password: data.password,
        name: data.name,
        emailSent: data.emailSent,
        emailTo: data.emailTo,
        message: data.message,
      });
      toast({
        title: data.emailSent ? 'Approved — email sent' : 'Approved',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-monitor-bankers'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (bankerId: string) => rejectBanker(bankerId),
    onSuccess: () => {
      toast({ title: 'Registration rejected' });
      queryClient.invalidateQueries({ queryKey: ['admin-monitor-bankers'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!isPlatformAdminUser(admin)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
      </div>
    );
  }

  const recentAudit = overview?.recentAudit ?? [];
  const pendingBankers = bankers.filter((b) => b.approval_status === 'pending');
  const activeBankers = bankers.filter((b) => b.approval_status === 'approved');

  return (
    <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 text-teal-800">
            <ShieldCheck className="w-6 h-6" />
            <span className="text-sm font-semibold uppercase tracking-wide">Platform Admin</span>
          </div>
          <h1 className="text-3xl font-bold mt-1">Bank Monitor</h1>
          <p className="text-muted-foreground">
            Monitor activity across all banks and officers — full audit trail to prevent fraud
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Partner Banks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{overview?.banks.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Decisions Logged</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{overview?.totalAuditEvents ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Active Officers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {overview?.banks.reduce((n, b) => n + (b.active_officers ?? 0), 0) ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                High activity (7d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {bankers.filter((b) => (b.decisions_last_7_days ?? 0) >= 5).length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Officers with 5+ decisions</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-700" />
              Banks Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Bank</th>
                  <th className="py-2 pr-4">Officers</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Approvals (30d)</th>
                  <th className="py-2">Rejections (30d)</th>
                </tr>
              </thead>
              <tbody>
                {overview?.banks.map((bank) => {
                  const activity = overview.activityByBank.find(
                    (a) => a.bank_name === bank.bank_name
                  );
                  return (
                    <tr key={bank.bank_id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{bank.bank_name}</td>
                      <td className="py-3 pr-4">{bank.officer_count}</td>
                      <td className="py-3 pr-4">{bank.active_officers}</td>
                      <td className="py-3 pr-4 text-emerald-700">{activity?.approvals ?? 0}</td>
                      <td className="py-3 text-red-700">{activity?.rejections ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-700" />
              Register Bank Officer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Officers cannot self-register. Add name, email, and bank — credentials are emailed on approval.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Officer email (required)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newBank}
                onChange={(e) => setNewBank(e.target.value)}
              >
                <option value="BANK_HDFC">HDFC Bank</option>
                <option value="BANK_SBI">State Bank of India</option>
                <option value="BANK_ICICI">ICICI Bank</option>
              </select>
              <Input
                placeholder="Role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
              <Button
                className="sm:col-span-2"
                disabled={!newName.trim() || !newEmail.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register (pending)'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {issuedCreds && (
          <Card className={issuedCreds.emailSent ? 'border-emerald-300 bg-emerald-50/50' : 'border-amber-300 bg-amber-50/50'}>
            <CardHeader>
              <CardTitle className={issuedCreds.emailSent ? 'text-emerald-900' : 'text-amber-900'}>
                {issuedCreds.emailSent ? 'Credentials emailed to officer' : 'Issued credentials (shown once)'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>{issuedCreds.message}</p>
              <p><span className="text-muted-foreground">Name:</span> {issuedCreds.name}</p>
              <p className="font-mono"><span className="text-muted-foreground font-sans">Banker ID:</span> {issuedCreds.bankerId}</p>
              {issuedCreds.emailSent && issuedCreds.emailTo && (
                <p><span className="text-muted-foreground">Sent to:</span> {issuedCreds.emailTo}</p>
              )}
              {issuedCreds.password && (
                <p className="font-mono"><span className="text-muted-foreground font-sans">Password:</span> {issuedCreds.password}</p>
              )}
              <Button size="sm" variant="outline" onClick={() => setIssuedCreds(null)}>Dismiss</Button>
            </CardContent>
          </Card>
        )}

        {pendingBankers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending approval ({pendingBankers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingBankers.map((b) => (
                <div
                  key={b.banker_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/40"
                >
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.bank_name} · {b.role} · ID {b.banker_id}
                      {b.email ? ` · ${b.email}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(b.banker_id)}
                    >
                      Approve & email login
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(b.banker_id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Approved officers — enable / disable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeBankers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved bank officers yet</p>
            ) : (
              activeBankers.map((b) => (
              <div
                key={b.banker_id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-secondary/30"
              >
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.bank_name} · ID {b.banker_id} · {b.role}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total decisions: {b.total_decisions ?? 0} · Last 7 days:{' '}
                    {b.decisions_last_7_days ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {b.is_active ? 'Active' : 'Disabled'}
                  </span>
                  <Button
                    size="sm"
                    variant={b.is_active ? 'destructive' : 'outline'}
                    disabled={toggleMutation.isPending}
                    onClick={() =>
                      toggleMutation.mutate({ bankerId: b.banker_id, isActive: !b.is_active })
                    }
                  >
                    {b.is_active ? (
                      <>
                        <UserX className="w-4 h-4 mr-1" />
                        Disable
                      </>
                    ) : (
                      'Enable'
                    )}
                  </Button>
                </div>
              </div>
            )))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Trail — every approve/reject is logged</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions logged yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Officer</th>
                    <th className="py-2 pr-3">Bank</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudit.map((row) => (
                    <tr key={row.audit_id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap text-xs">
                        {row.created_at
                          ? format(new Date(row.created_at), 'MMM d, h:mm a')
                          : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {row.action === 'approve' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{row.banker_name}</td>
                      <td className="py-2 pr-3">{row.bank_name}</td>
                      <td className="py-2 pr-3">{row.customer_name || row.cust_id}</td>
                      <td className="py-2">
                        ₹{(row.approved_amount ?? row.requested_amount ?? 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
