import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "light";
  className?: string;
  asLink?: boolean;
}

export function Logo({ variant = "default", className, asLink = true }: LogoProps) {
  const isLight = variant === "light";

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Shield
        className={cn("w-7 h-7 shrink-0", isLight ? "text-white" : "text-teal-700")}
        strokeWidth={2}
      />
      <span
        className={cn(
          "text-xl font-bold tracking-tight",
          isLight ? "text-white" : "text-teal-800"
        )}
      >
        CredFlow
      </span>
    </span>
  );

  if (asLink) {
    return (
      <Link to="/" className="inline-flex hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
