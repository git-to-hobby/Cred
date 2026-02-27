import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  CheckCircle,
  CreditCard,
  Landmark,
  PieChart,
  Receipt,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

function CredFlowCreditCard() {
  return (
    <div className="aspect-[1.58/1] w-[190px] rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-4 shadow-2xl shadow-slate-900/35">
      <div className="flex items-start justify-between">
        <div className="h-7 w-9 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 shadow-inner" />
        <span className="text-[8px] font-bold tracking-[0.18em] text-white/45">CREDFLOW</span>
      </div>
      <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-white/75">•••• •••• 4821</p>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[7px] uppercase tracking-wider text-white/40">Card holder</p>
          <p className="text-[10px] font-semibold text-white/90">SONU K.</p>
        </div>
        <CreditCard className="h-4 w-4 text-white/30" />
      </div>
    </div>
  );
}

function PhoneScreen() {
  return (
    <div className="w-[252px] overflow-hidden rounded-[2rem] border-[7px] border-slate-900 bg-slate-900 shadow-[0_32px_64px_-20px_rgba(15,23,42,0.35)]">
      <div className="rounded-[1.55rem] bg-[#f8faf9] pb-3">
        <div className="relative flex items-center justify-between px-4 pb-1 pt-2.5">
          <span className="text-[9px] font-semibold text-slate-800">9:41</span>
          <div className="absolute left-1/2 top-1.5 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="relative">
            <Bell className="h-3.5 w-3.5 text-slate-600" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-1 ring-white" />
          </div>
        </div>

        <div className="flex items-start justify-between px-4 pb-3">
          <div>
            <p className="text-[10px] text-slate-400">Good morning</p>
            <p className="text-[15px] font-bold text-slate-900">
              Welcome, <span className="text-teal-700">Sonu</span>
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white shadow-md shadow-teal-600/30">
            S
          </div>
        </div>

        <div className="relative mx-3.5 rounded-2xl bg-gradient-to-br from-teal-600 via-teal-600 to-emerald-700 p-4 text-white shadow-lg shadow-teal-700/25">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-white/75" />
              <span className="text-[10px] text-white/75">Total Balance</span>
            </div>
            <Shield className="h-3.5 w-3.5 text-white/60" />
          </div>
          <p className="mt-2 text-[22px] font-bold tracking-tight">₹ 12,45,680</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] text-white/90">
            <TrendingUp className="h-3 w-3" />
            +₹85,000 this month
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 px-3.5 py-3.5">
          {[
            { icon: Send, label: "Send", bg: "bg-sky-100", color: "text-sky-600" },
            { icon: Receipt, label: "Pay", bg: "bg-amber-100", color: "text-amber-600" },
            { icon: Wallet, label: "Loan", bg: "bg-teal-100", color: "text-teal-700" },
            { icon: PieChart, label: "Invest", bg: "bg-violet-100", color: "text-violet-600" },
          ].map(({ icon: Icon, label, bg, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg} shadow-sm`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-[9px] font-medium text-slate-500">{label}</span>
            </div>
          ))}
        </div>

        <div className="mx-3.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-700">Pre-approved Loan</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-semibold text-emerald-700">
              <CheckCircle className="h-2.5 w-2.5" />
              Approved
            </span>
          </div>
          <p className="mt-1 text-lg font-bold text-slate-900">₹6,00,000</p>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[8px] text-slate-400">
              <span>Limit unlocked</span>
              <span>72%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" />
            </div>
          </div>
        </div>

        <div className="mx-3.5 mt-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Recent</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600">Home Loan EMI</span>
              <span className="text-[10px] font-semibold text-slate-800">-₹28,400</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600">Salary Credit</span>
              <span className="text-[10px] font-semibold text-teal-600">+₹85,000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroPhoneMockup() {
  return (
    <div className="hero-showcase relative mx-auto h-[560px] w-full max-w-[480px]">
      <div className="absolute inset-x-2 top-10 bottom-6 rounded-[2.25rem] bg-gradient-to-br from-emerald-100/90 via-teal-50/80 to-green-100/70 shadow-inner" />

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="absolute left-0 top-6 z-40 flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3.5 py-2 shadow-lg backdrop-blur-sm"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
        </div>
        <div>
          <p className="text-[10px] font-bold leading-none text-slate-800">Instant Approval</p>
          <p className="text-[9px] text-slate-500">In 15 minutes</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.6 }}
        className="absolute bottom-8 left-0 z-40 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-teal-800 to-teal-900 px-3.5 py-2.5 shadow-xl"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20">
          <Shield className="h-4 w-4 text-amber-300" />
        </div>
        <div>
          <p className="text-[9px] font-bold leading-tight text-white">RBI Registered NBFC</p>
          <p className="text-[8px] text-teal-200/80">Secure Banking</p>
        </div>
      </motion.div>

      {/* Phone stack — phone vertical & static; card emerges from behind */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[48%]">
        <div className="relative flex items-center justify-center">
          {/* Card BEHIND phone — slides out from back */}
          <motion.div
            className="absolute z-10"
            style={{ originX: 0.5, originY: 0.5 }}
            animate={{
              x: [8, -105, -105, 8],
              y: [60, -12, -12, 60],
              rotate: [-4, -32, -32, -4],
              scale: [0.88, 1, 1, 0.88],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: ["easeInOut", "easeOut", "linear", "easeInOut"],
              times: [0, 0.42, 0.72, 1],
            }}
          >
            <CredFlowCreditCard />
          </motion.div>

          {/* Phone — vertical, no motion */}
          <div className="relative z-30">
            <PhoneScreen />

            <div className="absolute -right-6 top-[118px] z-40 rounded-xl border border-white/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <p className="text-[8px] text-slate-400">Portfolio</p>
              <p className="flex items-center gap-0.5 text-xs font-bold text-teal-700">
                +12.4%
                <ArrowUpRight className="h-3 w-3" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
