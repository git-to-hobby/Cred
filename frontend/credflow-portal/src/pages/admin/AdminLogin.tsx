import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, ArrowRight, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { getStoredAdmin, isPlatformAdminUser, getAdminToken } from '@/lib/api/adminAuth';
import { isValidBankerId } from '@/lib/api/bankerId';
import { useToast } from '@/hooks/use-toast';

export default function AdminLogin() {
  const [bankerId, setBankerId] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, verifyOtp } = useAdminAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const token = getAdminToken();
    const user = getStoredAdmin();
    if (token && user) {
      navigate(isPlatformAdminUser(user) ? '/admin/monitor' : '/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const finishLogin = () => {
    const user = getStoredAdmin();
    queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    queryClient.invalidateQueries({ queryKey: ['admin-monitor-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-monitor-bankers'] });
    toast({
      title: 'Welcome',
      description: isPlatformAdminUser(user)
        ? 'Super admin access granted'
        : 'CredFlow Admin access granted',
    });
    navigate(isPlatformAdminUser(user) ? '/admin/monitor' : '/admin/dashboard');
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidBankerId(bankerId)) {
      toast({
        title: 'Invalid Banker ID',
        description: 'Use the ID issued to you by platform admin',
        variant: 'destructive',
      });
      return;
    }

    if (!password.trim()) {
      toast({ title: 'Password required', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const result = await login(bankerId, password);
    setIsLoading(false);

    if (!result.ok) {
      toast({
        title: 'Login failed',
        description: result.error || 'Invalid banker credentials',
        variant: 'destructive',
      });
      return;
    }

    if (result.requiresOtp && result.otpSessionId) {
      setOtpSessionId(result.otpSessionId);
      setOtpHint(result.message || 'Check your registered email for the verification code');
      toast({ title: 'Verification code sent', description: result.message });
      return;
    }

    finishLogin();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSessionId || otp.length < 6) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const result = await verifyOtp(otpSessionId, bankerId, otp);
    setIsLoading(false);

    if (result.ok) {
      finishLogin();
    } else {
      toast({
        title: 'Verification failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CredFlow
          </Link>
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-large p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-700/10 mb-4">
              <Shield className="w-8 h-8 text-teal-700" />
            </div>
            <h1 className="text-2xl font-bold">CredFlow Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {otpSessionId ? 'Super admin email verification' : 'Authorized banker access only'}
            </p>
          </div>

          {!otpSessionId ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Banker ID</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={bankerId}
                    onChange={(e) => setBankerId(e.target.value.trim())}
                    placeholder="Issued Banker ID (e.g. BK...)"
                    className="pl-11 font-mono tracking-wide text-sm"
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Admin password"
                    className="pl-11"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800"
                disabled={!isValidBankerId(bankerId) || !password.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">{otpHint}</p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email verification code</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className="pl-11 font-mono text-lg tracking-widest text-center"
                    maxLength={6}
                    autoComplete="one-time-code"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800"
                disabled={otp.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpSessionId(null);
                  setOtp('');
                }}
              >
                Back to login
              </Button>
            </form>
          )}

          <p className="mt-6 text-xs text-center text-muted-foreground">
            Bank officers cannot self-register. Platform admin must approve your account first.
          </p>
        </div>
      </div>
    </div>
  );
}
