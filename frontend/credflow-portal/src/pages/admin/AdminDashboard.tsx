import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, XCircle, Clock, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminCustomers } from '@/lib/api/admin';
import { useAdminAuthenticated } from '@/hooks/useAdminAuthenticated';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { queryEnabled } = useAdminAuthenticated();
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: getAdminCustomers,
    enabled: queryEnabled,
  });

  const approved = customers.filter((c) => c.loan_status === 'Approved').length;
  const rejected = customers.filter((c) => c.loan_status === 'Rejected').length;
  const pending = customers.filter(
    (c) => !c.loan_status || c.loan_status === 'Pending' || c.loan_status === 'Under Review'
  ).length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">CredFlow loan operations overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Total Customers', value: customers.length, icon: Users, color: 'text-teal-700' },
            { title: 'Approved', value: approved, icon: CheckCircle, color: 'text-green-600' },
            { title: 'Rejected', value: rejected, icon: XCircle, color: 'text-red-600' },
            { title: 'Pending', value: pending, icon: Clock, color: 'text-amber-600' },
          ].map(({ title, value, icon: Icon, color }) => (
            <Card key={title}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className={`w-5 h-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-700" />
              Recent Customers
            </CardTitle>
            <button
              type="button"
              onClick={() => navigate('/admin/customers')}
              className="text-sm text-teal-700 hover:underline"
            >
              View all
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {customers.slice(0, 6).map((c) => (
              <button
                key={c.cust_id}
                type="button"
                onClick={() => navigate(`/admin/customers/${c.cust_id}`)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.cust_id}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-800">
                  {c.loan_status || 'No loan'}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
  );
}
