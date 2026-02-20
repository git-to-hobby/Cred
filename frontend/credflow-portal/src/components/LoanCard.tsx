import { ReactNode, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";

interface LoanCardProps {
  title: string;
  description: string;
  features: string[];
  icon: ReactNode;
  gradient: "personal" | "home" | "business" | "education";
  interestRate: string;
  maxAmount: string;
  delay?: number;
}

const cardStyles = {
  personal: {
    card: "bg-teal-50 border-teal-200",
    icon: "bg-teal-100 text-teal-700",
    divider: "border-teal-200/80",
    rate: "text-teal-800",
    btn: "bg-teal-600 hover:bg-teal-700 text-white",
    alert: "bg-white border-teal-500 text-teal-900 shadow-md",
    loginBtn: "bg-teal-600 hover:bg-teal-700 text-white",
  },
  home: {
    card: "bg-blue-50 border-blue-200",
    icon: "bg-blue-100 text-blue-700",
    divider: "border-blue-200/80",
    rate: "text-blue-800",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    alert: "bg-white border-blue-500 text-blue-900 shadow-md",
    loginBtn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  business: {
    card: "bg-orange-50 border-orange-200",
    icon: "bg-orange-100 text-orange-700",
    divider: "border-orange-200/80",
    rate: "text-orange-800",
    btn: "bg-orange-600 hover:bg-orange-700 text-white",
    alert: "bg-white border-orange-500 text-orange-900 shadow-md",
    loginBtn: "bg-orange-600 hover:bg-orange-700 text-white",
  },
  education: {
    card: "bg-violet-50 border-violet-200",
    icon: "bg-violet-100 text-violet-700",
    divider: "border-violet-200/80",
    rate: "text-violet-800",
    btn: "bg-violet-600 hover:bg-violet-700 text-white",
    alert: "bg-white border-violet-500 text-violet-900 shadow-md",
    loginBtn: "bg-violet-600 hover:bg-violet-700 text-white",
  },
};

export function LoanCard({
  title,
  description,
  features,
  icon,
  gradient,
  interestRate,
  maxAmount,
  delay = 0,
}: LoanCardProps) {
  const style = cardStyles[gradient];
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showLoginFirst, setShowLoginFirst] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const loginMessage = `${title} apply karne ke liye pehle login karein.`;

  useEffect(() => {
    if (showLoginFirst && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showLoginFirst]);

  const goToLogin = () => {
    navigate("/login", { state: { from: "loan-apply", loanType: title } });
  };

  const handleApply = () => {
    if (isLoading) return;

    if (isAuthenticated) {
      navigate("/ai-assistant", { state: { loanType: title, apply: true } });
      return;
    }

    setShowLoginFirst(true);
    toast({
      title: "Login first",
      description: loginMessage,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={cn(
        "rounded-2xl border p-6 shadow-soft hover:shadow-lg transition-shadow duration-300 flex flex-col overflow-visible",
        style.card,
        showLoginFirst && "shadow-lg"
      )}
    >
      <div className="space-y-4 flex flex-col">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
              style.icon
            )}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-4 py-3 border-y", style.divider)}>
          <div>
            <p className="text-muted-foreground text-xs">Interest Rate</p>
            <p className={cn("text-xl font-bold", style.rate)}>{interestRate}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Max Amount</p>
            <p className={cn("text-xl font-bold", style.rate)}>{maxAmount}</p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.rate.replace("text-", "bg-"))} />
              {feature}
            </li>
          ))}
        </ul>

        <div className="pt-1">
          {showLoginFirst ? (
            <div
              className={cn("rounded-xl border-2 p-4 text-center space-y-3", style.alert)}
              role="alert"
            >
              <p className="font-bold text-base">Login first</p>
              <p className="text-sm font-medium leading-snug">
                {title} apply karne ke liye pehle login karein
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2",
                  style.loginBtn
                )}
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={isLoading}
              className={cn(
                "apply-btn-vibrate w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60",
                style.btn
              )}
            >
              {isLoading ? "Please wait..." : "Apply Now"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
