import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, MessageSquare, User, XCircle, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getAdminCustomer, getAdminChatHistory, decideLoan } from '@/lib/api/admin';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { isPlatformAdminUser } from '@/lib/api/adminAuth';
import { useAdminAuthenticated } from '@/hooks/useAdminAuthenticated';
import { useToast } from '@/hooks/use-toast';
import type { AdminLoan } from '@/types/admin';

function isPendingLoan(status?: string | null) {
  const s = (status || '').toLowerCase();
  return !s || s === 'pending' || s === 'under review';
}

function loanStatusBadge(status?: string | null) {
  const s = (status || 'Pending').toLowerCase();
  if (s === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (s === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

function LoanRow({
  loan,
  onDecided,
  readOnly,
}: {
  loan: AdminLoan;
  onDecided: () => void;
  readOnly?: boolean;
}) {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const pending = isPendingLoan(loan.status);

  const mutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      decideLoan(loan.loan_id, action, note.trim() || undefined),
    onSuccess: (data) => {
      toast({
        title: data.loan.status === 'Approved' ? 'Loan approved' : 'Loan rejected',
        description: `${data.bankName} — ${data.bankerName}`,
      });
      setNote('');
      setShowNote(false);
      onDecided();
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">Loan #{loan.loan_id}</p>
          <p className="text-sm text-muted-foreground">
            Requested: ₹{(loan.requested_amount ?? 0).toLocaleString('en-IN')}
          </p>
          {loan.created_at && (
            <p className="text-xs text-muted-foreground">
              Applied {format(new Date(loan.created_at), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${loanStatusBadge(loan.status)}`}>
          {loan.status || 'Pending'}
        </span>
      </div>

      {!pending && loan.review_note && (
        <p className="text-sm text-muted-foreground border-l-2 border-teal-600 pl-3">{loan.review_note}</p>
      )}

      {pending && readOnly && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          Platform admin view only — bank officer must approve/reject
        </p>
      )}

      {pending && !readOnly && (
        <div className="space-y-3 pt-1 border-t">
          <p className="text-xs text-teal-800">
            You are approving as <strong>{admin?.bankName}</strong> ({admin?.name})
          </p>
          {showNote && (
            <Textarea
              placeholder="Optional note (e.g. reason for rejection)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="text-sm"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('approve')}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => {
                if (!showNote) {
                  setShowNote(true);
                  return;
                }
                mutation.mutate('reject');
              }}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
            {!showNote && (
              <Button size="sm" variant="ghost" onClick={() => setShowNote(true)}>
                Add note
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCustomerDetail() {
  const { custId } = useParams<{ custId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { admin } = useAdminAuth();
  const { queryEnabled } = useAdminAuthenticated();
  const readOnly = isPlatformAdminUser(admin);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['admin-customer', custId],
    queryFn: () => getAdminCustomer(custId!),
    enabled: queryEnabled && !!custId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['admin-chat', custId],
    queryFn: () => getAdminChatHistory(custId!),
    enabled: queryEnabled && !!custId,
  });

  const refreshCustomer = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-customer', custId] });
    queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
      </div>
    );
  }

  if (!customer) {
    return (
      <p className="text-center py-16 text-muted-foreground">Customer not found</p>
    );
  }

  const loans = customer.loans ?? [];

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/customers')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{customer.cust_id}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-teal-700" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Phone:</span> {customer.phone}</p>
              <p><span className="text-muted-foreground">Address:</span> {customer.address}</p>
              <p><span className="text-muted-foreground">Credit score:</span> {customer.credit_score}</p>
              <p><span className="text-muted-foreground">Category:</span> {customer.category}</p>
              <p><span className="text-muted-foreground">Pre-approved:</span> ₹{customer.pre_approved_limit?.toLocaleString('en-IN')}</p>
              <p><span className="text-muted-foreground">Latest loan:</span> {customer.loan_status || '—'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-teal-700" />
                Chat History
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">No chat messages yet</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id ?? i} className="p-3 rounded-lg bg-secondary/60 text-sm">
                    <p className="font-medium capitalize text-xs text-muted-foreground mb-1">
                      {msg.sender}
                      {msg.timestamp && ` · ${format(new Date(msg.timestamp), 'MMM d, h:mm a')}`}
                    </p>
                    <p>{msg.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-teal-700" />
              Loan Applications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No loan applications yet</p>
            ) : (
              loans.map((loan) => (
                <LoanRow key={loan.loan_id} loan={loan} onDecided={refreshCustomer} readOnly={readOnly} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
  );
}
