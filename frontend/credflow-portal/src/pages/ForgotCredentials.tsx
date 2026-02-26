import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, Phone, KeyRound, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { ApiClientError } from "@/lib/api/client";
import {
  forgotCustomerIdByEmail,
  forgotCustomerIdByPhone,
  requestPasswordReset,
  resetPasswordWithOtp,
  resetPasswordByPhone,
} from "@/lib/api/auth";

type Tab = "customer-id" | "password";
type IdMethod = "email" | "phone";
type PwdMethod = "email" | "phone";

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export default function ForgotCredentials() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("customer-id");
  const [idMethod, setIdMethod] = useState<IdMethod>("email");
  const [pwdMethod, setPwdMethod] = useState<PwdMethod>("email");
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Customer ID
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [recoveredId, setRecoveredId] = useState<string | null>(null);

  // Forgot Password (email OTP)
  const [custId, setCustId] = useState("");
  const [pwdEmail, setPwdEmail] = useState("");
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleForgotIdEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const res = await forgotCustomerIdByEmail(email);
      toast({ title: "Check your email", description: res.message });
    } catch (err) {
      toast({ title: "Request failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotIdPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaarLast4.length !== 4) {
      toast({ title: "Invalid Aadhaar", description: "Enter last 4 digits", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await forgotCustomerIdByPhone(phone, aadhaarLast4);
      setRecoveredId(res.custId);
      toast({ title: "Customer ID found", description: res.message });
    } catch (err) {
      toast({ title: "Verification failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custId.trim() || !pwdEmail.trim()) return;
    setIsLoading(true);
    try {
      const res = await requestPasswordReset(custId, pwdEmail);
      setOtpSessionId(res.otpSessionId);
      toast({ title: "Code sent", description: res.message });
    } catch (err) {
      toast({ title: "Request failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSessionId) return;
    if (newPassword.length < 6) {
      toast({ title: "Weak password", description: "At least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await resetPasswordWithOtp({
        otpSessionId,
        custId: custId.trim(),
        email: pwdEmail.trim(),
        otp: otp.trim(),
        newPassword,
      });
      toast({ title: "Password updated", description: res.message });
      navigate("/login");
    } catch (err) {
      toast({ title: "Reset failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordResetPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Weak password", description: "At least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (aadhaarLast4.length !== 4) {
      toast({ title: "Invalid Aadhaar", description: "Enter last 4 digits", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await resetPasswordByPhone({
        custId: custId.trim(),
        phone: phone.trim(),
        aadhaarLast4,
        newPassword,
      });
      toast({ title: "Password updated", description: res.message });
      navigate("/login");
    } catch (err) {
      toast({ title: "Reset failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-page">
      <Navbar />

      <section className="relative min-h-screen flex items-center justify-center py-24 px-4">
        <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-large p-8">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
            <Link to="/login">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </Link>
          </Button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Account Recovery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Recover your Customer ID or reset your password
            </p>
          </div>

          <div className="flex rounded-lg bg-secondary p-1 mb-6">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === "customer-id" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => {
                setTab("customer-id");
                setRecoveredId(null);
              }}
            >
              Forgot Customer ID
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === "password" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setTab("password")}
            >
              Forgot Password
            </button>
          </div>

          {tab === "customer-id" ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={idMethod === "email" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setIdMethod("email");
                    setRecoveredId(null);
                  }}
                >
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={idMethod === "phone" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setIdMethod("phone");
                    setRecoveredId(null);
                  }}
                >
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  Phone + Aadhaar
                </Button>
              </div>

              {idMethod === "email" ? (
                <form onSubmit={handleForgotIdEmail} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Works only if you registered with an email. Otherwise use <strong>Phone + Aadhaar</strong>.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Registered email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Customer ID"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleForgotIdPhone} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Registered phone</label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aadhaar (last 4 digits)</label>
                    <Input
                      value={aadhaarLast4}
                      onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="1234"
                      maxLength={4}
                      className="font-mono"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !phone.trim() || aadhaarLast4.length !== 4}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Show ID"}
                  </Button>
                </form>
              )}

              {recoveredId && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center">
                  <p className="text-sm text-teal-800 mb-1">Your Customer ID</p>
                  <p className="text-xl font-mono font-bold text-teal-900">{recoveredId}</p>
                  <Button className="mt-3 w-full" size="sm" onClick={() => navigate("/login")}>
                    Go to login
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={pwdMethod === "email" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setPwdMethod("email");
                    setOtpSessionId(null);
                  }}
                >
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  Email OTP
                </Button>
                <Button
                  type="button"
                  variant={pwdMethod === "phone" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setPwdMethod("phone");
                    setOtpSessionId(null);
                  }}
                >
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  Phone + Aadhaar
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Customer ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={custId}
                    onChange={(e) => setCustId(e.target.value.toUpperCase())}
                    placeholder="Your Customer ID"
                    className="pl-10 font-mono"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {pwdMethod === "email" ? (
                !otpSessionId ? (
                  <form onSubmit={handlePasswordRequest} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Registered email</label>
                      <Input
                        type="email"
                        value={pwdEmail}
                        onChange={(e) => setPwdEmail(e.target.value)}
                        placeholder="you@example.com"
                        disabled={isLoading}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || !custId.trim() || !pwdEmail.trim()}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handlePasswordResetOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email verification code</label>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit code"
                        className="font-mono text-center tracking-widest"
                        maxLength={6}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Confirm password</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
                    </Button>
                  </form>
                )
              ) : (
                <form onSubmit={handlePasswordResetPhone} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Registered phone</label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aadhaar (last 4 digits)</label>
                    <Input
                      value={aadhaarLast4}
                      onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="1234"
                      maxLength={4}
                      className="font-mono"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      isLoading ||
                      !custId.trim() ||
                      !phone.trim() ||
                      aadhaarLast4.length !== 4 ||
                      !newPassword
                    }
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
