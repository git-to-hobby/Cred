import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Sparkles,
  FileText,
  CreditCard,
  HelpCircle,
  RefreshCw,
  Loader2,
  CheckCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext";
import { sendChatMessage, resetConversation } from "@/lib/api/chat";
import { warmApiService } from "@/lib/api/client";
import { VerificationUploadPanel } from "@/components/VerificationUploadPanel";
import { LanguagePicker } from "@/components/LanguagePicker";
import { assistantT } from "@/lib/i18n/assistant";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const verificationKeywords = [
  "upload", "salary", "bank statement", "document", "verify", "kyc",
  "slip", "verification", "aadhaar", "pan", "income", "statement",
  "अपलोड", "वेरिफ", "दस्तावेज", "दस्तावेज़", "वेतन", "सत्याप", "आधार", "पैन", "बैंक",
];

function messageNeedsVerification(content: string) {
  const lower = (typeof content === "string" ? content : String(content ?? "")).toLowerCase();
  return verificationKeywords.some((k) => lower.includes(k));
}

function MessageContent({ content }: { content: string }) {
  const text = typeof content === "string" ? content : String(content ?? "");
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <div className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

export default function AIAssistant() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { language, isSelected } = useLanguage();
  const { toast } = useToast();
  const t = assistantT(language ?? "en");

  const pendingApplyRef = useRef<{ loanType: string } | null>(null);
  const applySentRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingHint, setLoadingHint] = useState("");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [showVerificationPanel, setShowVerificationPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions = [
    { icon: CreditCard, label: t.qaEligibility, action: t.qaEligibilityMsg },
    { icon: FileText, label: t.qaDocs, action: t.qaDocsMsg },
    { icon: HelpCircle, label: t.qaEmi, action: t.qaEmiMsg },
    { icon: Sparkles, label: t.qaBest, action: t.qaBestMsg },
  ];

  useEffect(() => {
    const state = location.state as { loanType?: string; apply?: boolean } | null;
    if (state?.apply && state.loanType) {
      pendingApplyRef.current = { loanType: state.loanType };
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    warmApiService();
    const url = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    fetch(`${url}/`)
      .then((r) => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!isTyping) {
      setLoadingHint("");
      return;
    }
    setLoadingHint(t.loading1);
    const t1 = window.setTimeout(() => setLoadingHint(t.loading2), 4000);
    const t2 = window.setTimeout(() => setLoadingHint(t.loading3), 15000);
    const t3 = window.setTimeout(() => setLoadingHint(t.loading4), 45000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isTyping, t]);

  const handleSendMessage = useCallback(
    async (content: string, langOverride?: AppLanguage) => {
      if (!content.trim()) return;

      const lang = langOverride ?? language;
      if (!lang) return;

      if (!isAuthenticated || !user) {
        toast({
          title: t.authRequired,
          description: t.authRequiredDesc,
          variant: "destructive",
        });
        return;
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsTyping(true);

      try {
        const response = await sendChatMessage(user.custId, content.trim(), lang);
        const rawReply = response?.reply;
        const replyText =
          typeof rawReply === "string"
            ? rawReply.trim()
            : rawReply != null
              ? String(rawReply).trim()
              : t.noReply;
        const safeReply = replyText || t.noReply;

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: safeReply,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (messageNeedsVerification(safeReply)) {
          setShowVerificationPanel(true);
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "";
        const friendly =
          errMsg.includes("abort") || errMsg.includes("waking") ? t.timeout : errMsg || t.noReply;

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `${t.errorPrefix} ${friendly}`,
            timestamp: new Date(),
          },
        ]);

        toast({
          title: t.authRequired,
          description: friendly,
          variant: "destructive",
        });
      } finally {
        setIsTyping(false);
      }
    },
    [language, isAuthenticated, user, toast, t]
  );

  const handleInitialLanguage = async (lang: AppLanguage) => {
    applySentRef.current = false;
    const strings = assistantT(lang);
    if (isAuthenticated && user) {
      try {
        await resetConversation(user.custId);
      } catch {
        /* ignore */
      }
    }
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: strings.welcome,
        timestamp: new Date(),
      },
    ]);

    if (pendingApplyRef.current && isAuthenticated && user) {
      applySentRef.current = true;
      setShowVerificationPanel(true);
      const { loanType } = pendingApplyRef.current;
      pendingApplyRef.current = null;
      const msg = loanType.startsWith("NOC")
        ? strings.applyNoc(loanType)
        : strings.applyLoan(loanType);
      window.setTimeout(() => handleSendMessage(msg, lang), 400);
    }
  };

  useEffect(() => {
    if (language && messages.length === 0 && isSelected) {
      handleInitialLanguage(language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerificationComplete = useCallback(
    (payload: { message: string }) => {
      toast({
        title: t.docVerified,
        description: t.docVerifiedDesc,
      });

      window.setTimeout(() => {
        void handleSendMessage(payload.message).catch((err) => {
          console.error("Post-upload chat failed:", err);
        });
      }, 300);
    },
    [handleSendMessage, toast, t.docVerified, t.docVerifiedDesc]
  );

  const handleReset = async () => {
    if (!language) return;

    if (!isAuthenticated || !user) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t.welcome,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    try {
      await resetConversation(user.custId);
      applySentRef.current = false;
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t.welcome,
          timestamp: new Date(),
        },
      ]);
      toast({ title: t.resetDone, description: t.resetDoneDesc });
    } catch {
      toast({
        title: t.authRequired,
        description: t.resetFail,
        variant: "destructive",
      });
    }
  };

  const chatDisabled = !isSelected || !isAuthenticated;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-20 pb-4 flex flex-col">
        <div className="container mx-auto px-4 flex-1 flex flex-col max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-6"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{t.pageTitle}</h1>
              {isSelected && <LanguagePicker compact />}
            </div>
            <p className="text-muted-foreground text-sm mt-2">{t.pageSubtitle}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative flex-1 flex flex-col bg-gradient-to-br from-white via-teal-50/10 to-blue-50/10 rounded-2xl border border-teal-200/50 shadow-lg shadow-teal-500/10 overflow-hidden min-h-[480px]"
          >
            {!isSelected && <LanguagePicker onSelect={handleInitialLanguage} />}

            {backendOk === false && (
              <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    {t.backendOffline}{" "}
                    <code className="text-xs bg-destructive/10 px-1 rounded">python main.py</code> (8000)
                  </span>
                </div>
              </div>
            )}

            {isAuthenticated && user ? (
              <div className="bg-success/10 border-b border-success/20 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {t.connectedAs} <strong>{user.name ?? user.custId}</strong> ({user.custId})
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-warning/10 border-b border-warning/20 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <Info className="w-4 h-4" />
                  <span>
                    {t.loginPrompt}{" "}
                    <a href="/login" className="underline font-medium">{t.loginLink}</a>
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-teal-500 to-blue-600 text-white rounded-tr-sm shadow-teal-500/30"
                          : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800 rounded-tl-sm shadow-slate-200/50"
                      }`}
                    >
                      <MessageContent content={message.content} />
                      <p
                        className={`text-xs mt-2 ${
                          message.role === "user"
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {(message.timestamp instanceof Date
                          ? message.timestamp
                          : new Date(message.timestamp)
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    {loadingHint && (
                      <p className="text-xs text-muted-foreground mt-2 max-w-[220px]">{loadingHint}</p>
                    )}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {isSelected && messages.length <= 2 && (
              <div className="px-4 py-3 border-t border-border bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-2">{t.quickActions}</p>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage(action.action)}
                      disabled={chatDisabled || isTyping}
                      className="text-xs"
                    >
                      <action.icon className="w-3 h-3 mr-1" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {isAuthenticated && user && language && showVerificationPanel && (
              <VerificationUploadPanel
                customerId={user.custId}
                language={language}
                onVerified={handleVerificationComplete}
                onError={(msg) =>
                  toast({
                    title: t.verification.title,
                    description: typeof msg === "string" ? msg : String(msg ?? "Upload failed"),
                    variant: "destructive",
                  })
                }
              />
            )}

            <div className="p-4 border-t border-teal-200/30 bg-gradient-to-br from-white to-teal-50/30 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex gap-3"
              >
                <div className="flex-1 relative">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isAuthenticated ? t.inputPlaceholder : t.inputLogin}
                    className="border-teal-200/50 focus:border-teal-500 focus:ring-teal-500/20 bg-white/80 backdrop-blur-sm"
                    disabled={isTyping || chatDisabled}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping || chatDisabled}
                  className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-md shadow-teal-500/30"
                >
                  {isTyping ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  title="Reset"
                  disabled={chatDisabled}
                  className="border-teal-200/50 hover:bg-teal-50 hover:border-teal-400"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </form>
              {isSelected && !showVerificationPanel && isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setShowVerificationPanel(true)}
                  className="mt-2 text-xs text-teal-700 hover:underline"
                >
                  {t.openVerification}
                </button>
              )}
            </div>
          </motion.div>

          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">{t.disclaimer}</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
