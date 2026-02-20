import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  User, 
  CreditCard, 
  FileText, 
  Bell, 
  Download, 
  ChevronRight,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  IndianRupee,
  Percent,
  CalendarDays,
  AlertCircle,
  Settings,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { formatCurrency, formatIndianNumber, calculateEMI } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getCustomerDetail, downloadSanctionLetter, downloadLoanStatement, type CustomerDetail, type Loan } from "@/lib/api/customer";
import { verifyKyc } from "@/lib/api/documents";
import { useToast } from "@/hooks/use-toast";
import { DashboardSettingsDialog } from "@/components/DashboardSettingsDialog";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [customerData, setCustomerData] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showFullEmiSchedule, setShowFullEmiSchedule] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<"verified" | "pending" | "not_verified" | "loading">("loading");
  const [kycMessage, setKycMessage] = useState("");

  const pendingLoanType = (location.state as { loanType?: string } | null)?.loanType;

  useEffect(() => {
    if (pendingLoanType) {
      navigate("/ai-assistant", {
        replace: true,
        state: { loanType: pendingLoanType, apply: true },
      });
    }
  }, [pendingLoanType, navigate]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadCustomerData();
  }, [user, navigate]);

  const loadCustomerData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const data = await getCustomerDetail(user.custId);
      setCustomerData(data);
      if (data.loans && data.loans.length > 0) {
        setSelectedLoan(data.loans[0]);
      }
      try {
        const kyc = await verifyKyc(user.custId);
        const status = kyc.kyc_status === "verified" ? "verified" : kyc.kyc_status === "pending" ? "pending" : "not_verified";
        setKycStatus(status);
        setKycMessage(kyc.message || "");
      } catch {
        setKycStatus("not_verified");
        setKycMessage("Could not check KYC status.");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load customer data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingLoanType) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customerData || !user) {
    return null;
  }

  const loans = customerData.loans || [];
  const userData = {
    name: customerData.name,
    email: customerData.email || "—",
    mobile: customerData.phone,
    pan: customerData.aadhaar?.slice(0, 10) || "N/A",
    avatar: customerData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
  };

  const handleProfileUpdated = (updated: CustomerDetail) => {
    setCustomerData(updated);
  };

  const handleNameUpdated = (name: string) => {
    if (user) {
      const updated = { ...user, name };
      setUser(updated);
      localStorage.setItem("credflow_user", JSON.stringify(updated));
    }
  };

  const handleApplyLoan = (loanType = "Personal Loan") => {
    navigate("/ai-assistant", { state: { loanType, apply: true } });
  };

  const requireSelectedLoan = () => {
    if (!selectedLoan || !user) {
      toast({
        title: "Select a loan",
        description: "Pehle apna active loan select karein.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleDownloadSanction = async () => {
    if (!requireSelectedLoan() || !user || !selectedLoan) return;
    setDownloading("sanction");
    try {
      await downloadSanctionLetter(user.custId, selectedLoan.loan_id);
      toast({ title: "Download started", description: "Sanction letter download ho gaya." });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Sanction letter abhi available nahi hai.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadStatement = async () => {
    if (!requireSelectedLoan() || !user || !selectedLoan) return;
    setDownloading("statement");
    try {
      await downloadLoanStatement(user.custId, selectedLoan.loan_id);
      toast({ title: "Download started", description: "Loan statement download ho gaya." });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Statement download nahi ho paya.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handlePayEmi = () => {
    if (!requireSelectedLoan() || !selectedLoan) return;
    const amount = selectedLoan.approved_amount || selectedLoan.requested_amount;
    const rate = selectedLoan.interest_rate || 0;
    const tenure = selectedLoan.tenure_months || 0;
    const emi = amount && rate && tenure ? calculateEMI(amount, rate, tenure).emi : 0;
    toast({
      title: "EMI Payment",
      description: emi
        ? `Aapka agla EMI ${formatCurrency(emi)} hai. Payment gateway jald launch hoga — abhi AI Assistant se help lein.`
        : "EMI details ke liye AI Assistant se baat karein.",
    });
  };

  const handleRequestNoc = () => {
    if (!requireSelectedLoan() || !selectedLoan) return;
    navigate("/ai-assistant", {
      state: {
        apply: true,
        loanType: `NOC for Loan #${selectedLoan.loan_id}`,
      },
    });
  };

  // Calculate EMI for a loan (simplified)
  const calcMonthlyEmi = (principal: number, rate: number, months: number): number => {
    const monthlyRate = rate / 12 / 100;
    if (monthlyRate === 0) return principal / months;
    return Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
  };

  // Generate mock EMI schedule (in production, this would come from backend)
  const getEMISchedule = (loan: Loan) => {
    if (!loan.tenure_months || !loan.approved_amount || !loan.interest_rate) return [];
    const emi = calcMonthlyEmi(loan.approved_amount, loan.interest_rate, loan.tenure_months);
    const limit = showFullEmiSchedule ? loan.tenure_months : Math.min(4, loan.tenure_months);
    const schedule = [];
    for (let i = 0; i < limit; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1);
      schedule.push({
        month: date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        principal: Math.round(emi * 0.7),
        interest: Math.round(emi * 0.3),
        total: emi,
        status: "upcoming" as const,
      });
    }
    return schedule;
  };

  const emiSchedule = selectedLoan ? getEMISchedule(selectedLoan) : [];

  // Mock notifications (in production, this would come from backend)
  const notifications = [
    {
      id: 1,
      type: "payment" as const,
      title: "EMI Due Reminder",
      message: selectedLoan ? `Your loan EMI is due soon` : "No active loans",
      time: "2 hours ago",
      read: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Welcome back, {userData.name.split(" ")[0]}!
                </h1>
                <p className="text-muted-foreground mt-1">
                  Here's an overview of your loan portfolio
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {kycStatus === "loading" ? (
                    <Badge variant="outline" className="gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking KYC…
                    </Badge>
                  ) : kycStatus === "verified" ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                      <CheckCircle className="w-3 h-3" />
                      KYC Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 gap-1">
                      <AlertCircle className="w-3 h-3" />
                      KYC Pending
                    </Badge>
                  )}
                  {kycStatus !== "verified" && kycStatus !== "loading" && (
                    <Button
                      size="sm"
                      variant="link"
                      className="h-auto p-0 text-teal-700"
                      onClick={() => navigate("/ai-assistant")}
                    >
                      Complete KYC in AI Assistant →
                    </Button>
                  )}
                </div>
                {kycMessage && kycStatus !== "loading" && (
                  <p className="text-xs text-muted-foreground mt-1">{kycMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => handleApplyLoan()}>
                  Apply for Loan
                </Button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Account settings"
                  title="Account settings"
                  className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-200/70 bg-gradient-to-br from-white to-teal-50/60 shadow-sm transition-all duration-300 hover:border-teal-400 hover:from-teal-50 hover:to-teal-100/80 hover:shadow-[0_4px_14px_-4px_rgba(13,148,136,0.45)] active:scale-95"
                >
                  <Settings className="h-[15px] w-[15px] text-teal-700 transition-transform duration-500 group-hover:rotate-[72deg]" />
                  <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-[1.5px] ring-white" />
                </button>
              </div>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="dashboard-card bg-gradient-to-br from-white via-teal-50/20 to-blue-50/20 border-teal-200/50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-teal-500/30">
                    {userData.avatar}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">{userData.name}</h2>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-muted-foreground">
                      <span>{userData.email}</span>
                      <span>{userData.mobile}</span>
                      <span>PAN: {userData.pan}</span>
                    </div>
                  </div>
                  <Badge variant="success" className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 shadow-md">Verified</Badge>
                </div>
              </motion.div>

              {/* Loan Status Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Your Active Loans
                </h3>

                {loans.length === 0 ? (
                  <div className="dashboard-card text-center py-12">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No active loans found</p>
                    <Button className="mt-4" onClick={() => handleApplyLoan()}>
                      Apply for a Loan
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {loans.map((loan) => {
                      const emi = loan.approved_amount && loan.interest_rate && loan.tenure_months
                        ? calcMonthlyEmi(loan.approved_amount, loan.interest_rate, loan.tenure_months)
                        : 0;
                      const progress = loan.tenure_months ? Math.min(100, ((loan.tenure_months - (loan.tenure_months * 0.5)) / loan.tenure_months) * 100) : 0;
                      
                      return (
                        <div
                          key={loan.loan_id}
                          onClick={() => setSelectedLoan(loan)}
                          className={`dashboard-card cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${
                            selectedLoan?.loan_id === loan.loan_id
                              ? "ring-2 ring-teal-500 bg-gradient-to-br from-teal-50/30 to-blue-50/30 border-teal-300"
                              : "hover:border-teal-400/50 bg-gradient-to-br from-white to-slate-50/50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Loan #{loan.loan_id}</p>
                              <p className="text-2xl font-bold text-foreground bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                                {formatCurrency(loan.approved_amount || loan.requested_amount)}
                              </p>
                            </div>
                            <Badge 
                              variant={loan.status === 'approved' ? 'success' : loan.status === 'pending' ? 'info' : 'destructive'}
                              className={loan.status === 'approved' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 shadow-md' : ''}
                            >
                              {loan.status}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Loan ID</span>
                              <span className="font-medium text-foreground">{loan.loan_id}</span>
                            </div>
                            {emi > 0 && (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Monthly EMI</span>
                                  <span className="font-medium text-foreground">{formatCurrency(emi)}</span>
                                </div>
                                {loan.tenure_months && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tenure</span>
                                    <span className="font-medium text-foreground">{loan.tenure_months} months</span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Progress Bar */}
                            {loan.tenure_months && (
                              <div className="pt-2">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                  <span>Progress</span>
                                  <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Loan Details */}
              {selectedLoan && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="dashboard-card bg-gradient-to-br from-white via-teal-50/20 to-blue-50/20 border-teal-200/50"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    Loan Details - Loan #{selectedLoan.loan_id}
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl border border-teal-200/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <IndianRupee className="w-4 h-4 text-teal-600" />
                        Principal
                      </div>
                      <p className="text-xl font-bold text-foreground bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                        {formatCurrency(selectedLoan.approved_amount || selectedLoan.requested_amount)}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Percent className="w-4 h-4 text-blue-600" />
                        Interest Rate
                      </div>
                      <p className="text-xl font-bold text-foreground bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                        {selectedLoan.interest_rate ? `${selectedLoan.interest_rate}% p.a.` : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-200/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <CalendarDays className="w-4 h-4 text-amber-600" />
                        Tenure
                      </div>
                      <p className="text-xl font-bold text-foreground bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        {selectedLoan.tenure_months ? `${selectedLoan.tenure_months} Months` : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <IndianRupee className="w-4 h-4 text-emerald-600" />
                        Status
                      </div>
                      <p className="text-xl font-bold text-foreground capitalize bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        {selectedLoan.status}
                      </p>
                    </div>
                  </div>

                  {/* Outstanding */}
                  {selectedLoan.sanction_letter_path && (
                    <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Sanction Letter</p>
                          <p className="text-sm font-medium text-primary">
                            Available for download
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleDownloadSanction}
                          disabled={downloading === "sanction"}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {downloading === "sanction" ? "Downloading..." : "Download Letter"}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* EMI Schedule Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="dashboard-card"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Upcoming EMI Schedule
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullEmiSchedule((v) => !v)}
                    disabled={!selectedLoan?.tenure_months}
                  >
                    {showFullEmiSchedule ? "Show Less" : "View All"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground border-b border-border">
                        <th className="pb-3 font-medium">Month</th>
                        <th className="pb-3 font-medium text-right">Principal</th>
                        <th className="pb-3 font-medium text-right">Interest</th>
                        <th className="pb-3 font-medium text-right">Total EMI</th>
                        <th className="pb-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emiSchedule.map((emi, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-3 font-medium text-foreground">{emi.month}</td>
                          <td className="py-3 text-right text-muted-foreground">
                            {formatCurrency(emi.principal)}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {formatCurrency(emi.interest)}
                          </td>
                          <td className="py-3 text-right font-semibold text-foreground">
                            {formatCurrency(emi.total)}
                          </td>
                          <td className="py-3 text-center">
                            <Badge variant="info">
                              <Clock className="w-3 h-3 mr-1" />
                              Upcoming
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Notifications */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="dashboard-card"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    Notifications
                  </h3>
                  <Badge variant="secondary">{notifications.filter((n) => !n.read).length} new</Badge>
                </div>

                <div className="space-y-4">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-lg border ${
                        notif.read
                          ? "bg-background border-border"
                          : "bg-primary/5 border-primary/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            notif.type === "payment"
                              ? "bg-warning/10 text-warning"
                              : notif.type === "offer"
                              ? "bg-info/10 text-info"
                              : "bg-success/10 text-success"
                          }`}
                        >
                          {notif.type === "payment" ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : notif.type === "offer" ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="ghost" className="w-full mt-4" size="sm">
                  View All Notifications
                </Button>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="dashboard-card"
              >
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Quick Actions
                </h3>

                <div className="space-y-2">
                  {[
                    { icon: Download, label: "Download Loan Statement", action: handleDownloadStatement },
                    { icon: FileText, label: "Request NOC Certificate", action: handleRequestNoc },
                    { icon: CreditCard, label: "Pay EMI Now", action: handlePayEmi },
                    { icon: User, label: "Update Profile", action: () => setSettingsOpen(true) },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-foreground">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Need Help */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-primary rounded-2xl p-6 text-primary-foreground"
              >
                <h3 className="font-semibold mb-2">Need Help?</h3>
                <p className="text-sm text-primary-foreground/80 mb-4">
                  Our AI assistant is available 24/7 to answer your questions.
                </p>
                <Button
                  className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  onClick={() => navigate("/ai-assistant")}
                >
                  Chat with AI Assistant
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <DashboardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        customer={customerData}
        onUpdated={handleProfileUpdated}
        onNameUpdated={handleNameUpdated}
      />

      <Footer />
    </div>
  );
}
