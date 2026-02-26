import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, Loader2, Phone, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAdminCustomers } from '@/lib/api/admin';
import { useAdminAuthenticated } from '@/hooks/useAdminAuthenticated';

export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { queryEnabled } = useAdminAuthenticated();
  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: getAdminCustomers,
    enabled: queryEnabled,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.cust_id?.includes(q) ||
        c.phone?.includes(q)
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-teal-700" />
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">Manage loan applications</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, phone..."
            className="pl-10"
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
          </div>
        )}

        {error && (
          <p className="text-destructive text-center py-8">Failed to load customers. Check backend.</p>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card
              key={c.cust_id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/admin/customers/${c.cust_id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{c.cust_id}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-800">
                    {c.category}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> {c.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" /> Score: {c.credit_score}
                  </p>
                </div>
                {c.loan_status && (
                  <p className="mt-3 text-xs font-medium">Loan: {c.loan_status}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
  );
}
