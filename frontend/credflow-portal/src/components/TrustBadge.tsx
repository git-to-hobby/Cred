import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
  variant?: "teal" | "blue" | "amber" | "violet";
}

const variantStyles = {
  teal: "from-teal-500/15 to-emerald-500/5 border-teal-200/60 text-teal-700",
  blue: "from-sky-500/15 to-blue-500/5 border-sky-200/60 text-sky-700",
  amber: "from-amber-500/15 to-orange-500/5 border-amber-200/60 text-amber-700",
  violet: "from-violet-500/15 to-purple-500/5 border-violet-200/60 text-violet-700",
};

const iconBg = {
  teal: "bg-teal-500/15 text-teal-600",
  blue: "bg-sky-500/15 text-sky-600",
  amber: "bg-amber-500/15 text-amber-600",
  violet: "bg-violet-500/15 text-violet-600",
};

export function TrustBadge({
  icon,
  title,
  description,
  delay = 0,
  variant = "teal",
}: TrustBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "flex items-start gap-4 p-6 rounded-2xl border bg-gradient-to-br shadow-soft hover:shadow-medium hover:-translate-y-1 transition-all duration-300",
        variantStyles[variant]
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
          iconBg[variant]
        )}
      >
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
