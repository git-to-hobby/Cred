import { useState, useEffect } from "react";
import { warmCrmService, ApiClientError } from "@/lib/api/client";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CaptchaInput } from "@/components/CaptchaInput";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const loanApplyState = location.state as
    | { from?: string; loanType?: string }
    | null
    | undefined;
  const pendingLoanType =
    loanApplyState?.from === "loan-apply" ? loanApplyState.loanType : null;

  const [customerId, setCustomerId] = useState("");
  const [password, setPassword] = useState("");
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    warmCrmService();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId.trim()) {
      toast({
        title: "Customer ID Required",
        description: "Please enter your Customer ID",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password Required",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    if (!isCaptchaValid) {
      toast({
        title: "Invalid CAPTCHA",
        description: "Please enter the correct CAPTCHA",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await login(customerId.trim(), password);
      toast({
        title: "Login Successful",
        description: "Welcome back to CredFlow Finance!",
      });
      navigate(
        pendingLoanType
          ? "/ai-assistant"
          : "/dashboard",
        pendingLoanType
          ? { state: { loanType: pendingLoanType, apply: true } }
          : undefined
      );
    } catch (error: unknown) {
      const message =
        error instanceof ApiClientError
          ? error.status === 0
            ? "Cannot reach server. Run ./start-app.sh in the project folder, then retry."
            : error.message
          : error instanceof Error
            ? error.message
            : "Invalid credentials. Please try again.";
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-page">
      <Navbar />

      <section className="relative min-h-screen flex items-center justify-center py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="animated-blob w-96 h-96 bg-primary/10 top-20 -left-48" />
          <div className="animated-blob w-80 h-80 bg-accent/10 bottom-20 right-20" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-card rounded-2xl border border-border shadow-large p-8"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Customer Login
                </h1>
                <p className="text-muted-foreground text-sm">
                  Enter your credentials to access your account
                </p>
                {pendingLoanType && (
                  <p className="mt-3 text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                    Login karein to apply for <strong>{pendingLoanType}</strong>
                  </p>
                )}
              </div>

              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
                onSubmit={handleLogin}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Customer ID</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Enter your Customer ID (e.g., 711007500)"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value.toUpperCase())}
                      className="pl-12"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => navigate("/forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot Customer ID or Password?
                    </button>
                  </div>
                </div>

                <CaptchaInput onVerify={setIsCaptchaValid} />

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      Login
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    New customer?{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="text-primary font-medium hover:underline"
                    >
                      Create an account
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Existing customer but don't have credentials?{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="text-primary font-medium hover:underline"
                    >
                      Register here
                    </button>
                  </p>
                </div>
              </motion.form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-center"
            >
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Your data is protected with bank-grade encryption</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
