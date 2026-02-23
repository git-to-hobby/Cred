import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLanguage } from "@/contexts/LanguageContext";
import { assistantT } from "@/lib/i18n/assistant";
import {
  verifySalaryDocument,
  verifyBankStatement,
  verifyKyc,
  verifyKycDocument,
} from "@/lib/api/documents";
import { ApiClientError } from "@/lib/api/client";
import {
  Building2,
  CheckCircle2,
  FileText,
  IdCard,
  Loader2,
  Upload,
  Download,
  Wallet,
} from "lucide-react";

const SAMPLE_SALARY_URL = "/samples/sample_salary_slip.pdf";

export type VerificationResultPayload = {
  type: "salary" | "bank" | "kyc";
  message: string;
};

interface VerificationUploadPanelProps {
  customerId: string;
  language: AppLanguage;
  onVerified: (payload: VerificationResultPayload) => void;
  onError?: (message: string) => void;
}

function formatSalary(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(num)) return `₹${num.toLocaleString("en-IN")}`;
  return value != null ? String(value) : "—";
}

function formatUploadError(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return error.detail === "Customer not found"
        ? "Customer ID database mein nahi mili. Dubara login karein."
        : "Verification API nahi mili — backend restart karein (port 8000).";
    }
    return error.detail || error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function handleSalaryResult(
  result: Awaited<ReturnType<typeof verifySalaryDocument>>,
  onVerified: VerificationUploadPanelProps["onVerified"],
  onError: VerificationUploadPanelProps["onError"],
  v: ReturnType<typeof assistantT>["verification"],
  setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
) {
  if (result.status === "verified" && result.monthly_salary != null) {
    setDone((d) => ({ ...d, salary: true }));
    scheduleVerified(onVerified, {
      type: "salary",
      message: v.salaryVerified(
        formatSalary(result.monthly_salary),
        result.salary_source ?? undefined
      ),
    });
    return;
  }

  if (
    result.status === "manual_review" ||
    result.status === "failed" ||
    result.file_path
  ) {
    setDone((d) => ({ ...d, salary: true }));
    scheduleVerified(onVerified, {
      type: "salary",
      message:
        result.status === "failed"
          ? v.salaryReview
          : result.message
            ? `${v.salaryReview} ${result.message}`
            : v.salaryReview,
    });
    return;
  }

  onError?.(result.error || result.message || v.salaryFail);
}

function scheduleVerified(
  onVerified: VerificationUploadPanelProps["onVerified"],
  payload: VerificationResultPayload
) {
  window.setTimeout(() => {
    try {
      onVerified(payload);
    } catch (err) {
      console.error("Verification callback failed:", err);
    }
  }, 200);
}

export function VerificationUploadPanel({
  customerId,
  language,
  onVerified,
  onError,
}: VerificationUploadPanelProps) {
  const v = assistantT(language).verification;
  const salaryRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);
  const kycRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const handleSampleSalary = async () => {
    if (loading || done.salary) return;
    if (!customerId?.trim()) {
      onError?.("Please log in again — Customer ID missing.");
      return;
    }
    setLoading("salary");
    try {
      const res = await fetch(SAMPLE_SALARY_URL);
      if (!res.ok) throw new Error(v.sampleLoadFail);
      const blob = await res.blob();
      const file = new File([blob], "sample_salary_slip.pdf", {
        type: blob.type || "application/pdf",
      });
      const result = await verifySalaryDocument(customerId, file);
      handleSalaryResult(result, onVerified, onError, v, setDone);
    } catch (e: unknown) {
      onError?.(formatUploadError(e, v.sampleLoadFail));
    } finally {
      setLoading(null);
    }
  };

  const handleSalary = async (file: File) => {
    if (!customerId?.trim()) {
      onError?.("Please log in again — Customer ID missing.");
      return;
    }
    setLoading("salary");
    try {
      const result = await verifySalaryDocument(customerId, file);
      handleSalaryResult(result, onVerified, onError, v, setDone);
    } catch (e: unknown) {
      onError?.(formatUploadError(e, v.salaryFail));
    } finally {
      setLoading(null);
    }
  };

  const handleBank = async (file: File) => {
    setLoading("bank");
    try {
      const result = await verifyBankStatement(customerId, file);
      setDone((d) => ({ ...d, bank: true }));
      scheduleVerified(onVerified, {
        type: "bank",
        message: v.bankUploaded(result.score),
      });
    } catch (e: unknown) {
      onError?.(formatUploadError(e, v.bankFail));
    } finally {
      setLoading(null);
    }
  };

  const handleKycClick = async () => {
    setLoading("kyc");
    try {
      const result = await verifyKyc(customerId);
      if (result.kyc_status === "verified") {
        setDone((d) => ({ ...d, kyc: true }));
        scheduleVerified(onVerified, { type: "kyc", message: v.kycDone });
      } else {
        onError?.(result.message || v.kycPending);
      }
    } catch (e: unknown) {
      onError?.(formatUploadError(e, v.kycFail));
    } finally {
      setLoading(null);
    }
  };

  const handleKycDoc = async (file: File) => {
    setLoading("kyc-doc");
    try {
      const result = await verifyKycDocument(customerId, file);
      setDone((d) => ({ ...d, kyc: true }));
      scheduleVerified(onVerified, {
        type: "kyc",
        message: v.kycDoc(result.kyc_status ?? "uploaded"),
      });
    } catch (e: unknown) {
      onError?.(formatUploadError(e, v.kycDocFail));
    } finally {
      setLoading(null);
    }
  };

  const cards = [
    {
      id: "salary",
      icon: Wallet,
      title: v.salary,
      desc: v.salaryDesc,
      done: done.salary,
      action: () => salaryRef.current?.click(),
      loading: loading === "salary",
    },
    {
      id: "bank",
      icon: Building2,
      title: v.bank,
      desc: v.bankDesc,
      done: done.bank,
      action: () => bankRef.current?.click(),
      loading: loading === "bank",
    },
    {
      id: "kyc",
      icon: IdCard,
      title: v.kyc,
      desc: v.kycDesc,
      done: done.kyc,
      action: handleKycClick,
      loading: loading === "kyc" || loading === "kyc-doc",
    },
  ];

  return (
    <div className="mx-4 mb-3 rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/80 to-emerald-50/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-teal-700" />
        <p className="text-sm font-semibold text-teal-900">{v.title}</p>
        <Badge variant="outline" className="ml-auto border-teal-300 text-teal-700 text-[10px]">
          {v.badge}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-teal-800/80">{v.hint}</p>

      <div className="grid gap-2 sm:grid-cols-3">
        {cards.map(({ id, icon: Icon, title, desc, done, action, loading: isLoading }) => (
          <button
            key={id}
            type="button"
            onClick={action}
            disabled={!!loading || done}
            className="flex flex-col items-start gap-2 rounded-lg border border-white/80 bg-white/90 p-3 text-left transition hover:border-teal-300 hover:shadow-sm disabled:opacity-60"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              {!done && !isLoading && <Upload className="h-3.5 w-3.5 text-teal-500" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">{title}</p>
              <p className="text-[10px] text-slate-500">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-xs bg-teal-600 text-white hover:bg-teal-700"
          disabled={!!loading || done.salary}
          onClick={handleSampleSalary}
        >
          {loading === "salary" ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          {v.useSampleSalary}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs border-teal-200"
          asChild
        >
          <a href={SAMPLE_SALARY_URL} download="sample_salary_slip.pdf">
            <Download className="h-3 w-3 mr-1" />
            {v.downloadSampleSalary}
          </a>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs border-teal-200"
          disabled={!!loading}
          onClick={() => kycRef.current?.click()}
        >
          {v.uploadKyc}
        </Button>
      </div>

      <input
        ref={salaryRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleSalary(f);
          e.target.value = "";
        }}
      />
      <input
        ref={bankRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleBank(f);
          e.target.value = "";
        }}
      />
      <input
        ref={kycRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleKycDoc(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
