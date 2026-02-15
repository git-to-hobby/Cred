import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { warmCrmService } from "@/lib/api/client";
import {
  ArrowRight,
  Calculator,
  Shield,
  Clock,
  Users,
  Home as HomeIcon,
  Briefcase,
  GraduationCap,
  Wallet,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LoanCard } from "@/components/LoanCard";
import { TrustBadge } from "@/components/TrustBadge";
import { HeroPhoneMockup } from "@/components/HeroPhoneMockup";

const loanProducts = [
  {
    title: "Personal Loan",
    description: "For all your personal needs",
    features: ["No collateral required", "Minimal documentation", "Quick disbursement"],
    icon: <Wallet className="w-7 h-7" />,
    gradient: "personal" as const,
    interestRate: "10.5%",
    maxAmount: "₹40L",
  },
  {
    title: "Home Loan",
    description: "Make your dream home a reality",
    features: ["Up to 90% financing", "Flexible tenure", "Balance transfer facility"],
    icon: <HomeIcon className="w-7 h-7" />,
    gradient: "home" as const,
    interestRate: "8.5%",
    maxAmount: "₹5Cr",
  },
  {
    title: "Business Loan",
    description: "Fuel your business growth",
    features: ["Working capital support", "Equipment financing", "Overdraft facility"],
    icon: <Briefcase className="w-7 h-7" />,
    gradient: "business" as const,
    interestRate: "12%",
    maxAmount: "₹75L",
  },
  {
    title: "Education Loan",
    description: "Invest in your future",
    features: ["Cover tuition & living", "Moratorium period", "Tax benefits"],
    icon: <GraduationCap className="w-7 h-7" />,
    gradient: "education" as const,
    interestRate: "9.5%",
    maxAmount: "₹1Cr",
  },
];

const trustBadges = [
  {
    icon: <Shield className="w-6 h-6" />,
    title: "RBI Registered",
    description: "Fully compliant NBFC regulated by the Reserve Bank of India",
    variant: "teal" as const,
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: "Quick Approval",
    description: "Get loan approval in as fast as 4 hours with minimal documentation",
    variant: "blue" as const,
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "5 Lakh+ Customers",
    description: "Trusted by over 5 lakh customers across India",
    variant: "amber" as const,
  },
  {
    icon: <Award className="w-6 h-6" />,
    title: "Award Winning",
    description: "Recognized for excellence in digital lending innovation",
    variant: "violet" as const,
  },
];

const stats = [
  { value: "₹5000 Cr+", label: "Loans Disbursed", color: "text-teal-600" },
  { value: "5 Lakh+", label: "Happy Customers", color: "text-sky-600" },
  { value: "4.8/5", label: "Customer Rating", color: "text-amber-600" },
  { value: "15 Min", label: "Avg. Approval", color: "text-violet-600" },
];

const stepColors = [
  "from-teal-500 to-emerald-600",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-orange-500",
];

export default function Index() {
  useEffect(() => {
    warmCrmService();
  }, []);

  return (
    <div className="min-h-screen home-page-bg">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[92vh] flex items-center overflow-visible home-hero-bg">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_70%_40%,hsl(158_48%_88%/0.55),transparent_60%)]" />
        
        <div className="container mx-auto px-4 pt-28 pb-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-800 text-sm font-medium backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
                </span>
                Instant & Safe Loan Approval
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-teal-950 leading-[1.1] tracking-tight">
                Smart Loans.{" "}
                <span className="text-green-600">
                  Trusted Always.
                </span>
              </h1>

              <p className="text-lg text-teal-900/70 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Experience seamless digital lending with{" "}
                <span className="font-semibold text-teal-700">CredFlow Finance</span>.
                Instant approvals, competitive rates, and AI assistance tailored for you.
              </p>

              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <Button 
                  variant="hero" 
                  size="xl" 
                  asChild
                  className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 shadow-md hover:shadow-lg transition-all duration-300 border-0 font-semibold"
                >
                  <Link to="/login">
                    Apply Now
                    <ArrowRight className="w-5 h-5 ml-2 apply-arrow-move" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  className="border-teal-600/25 text-teal-800 bg-white/70 hover:bg-teal-50 hover:border-teal-600/40 hover:shadow-md transition-all duration-300 backdrop-blur-sm"
                  asChild
                >
                  <Link to="/emi-calculator">
                    <Calculator className="w-5 h-5 mr-2" />
                    Calculate EMI
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="bg-white/75 backdrop-blur-sm rounded-xl p-4 border border-teal-200/60 text-center hover:scale-105 hover:bg-white hover:shadow-md hover:border-teal-300/60 transition-all duration-300"
                  >
                    <p className={`text-xl md:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-teal-800/55 mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="flex justify-center lg:justify-end overflow-visible mt-8 lg:mt-0"
            >
              <HeroPhoneMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-16 bg-teal-100/35 border-y border-teal-200/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustBadges.map((badge, i) => (
              <TrustBadge key={badge.title} {...badge} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Loan Products */}
      <section className="py-20 bg-emerald-50/40">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold text-teal-700 mb-4"
            >
              Choose Your Loan Product
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Competitive rates and flexible terms designed for every financial goal.
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mx-auto mt-5 h-1 w-24 rounded-full bg-teal-500 origin-center"
            />
          </motion.div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
            {loanProducts.map((product, i) => (
              <LoanCard key={product.title} {...product} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-teal-50/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Get Your Loan in 3 Easy Steps
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our instant and safe loan approval process makes getting a loan simpler than ever.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Apply Online",
                description: "Fill out our simple application with basic details and documents.",
              },
              {
                step: "02",
                title: "AI Verification",
                description: "CredFlow AI verifies documents and assesses eligibility instantly.",
              },
              {
                step: "03",
                title: "Get Funds",
                description: "Approved funds disbursed to your bank account within 24 hours.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="step-card group hover:-translate-y-1"
              >
                <span
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${stepColors[i]} text-white font-bold text-lg mb-4 shadow-md`}
                >
                  {item.step}
                </span>
                <h3 className="text-xl font-bold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                {i < 2 && (
                  <ArrowRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 text-teal-500/40 z-20" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-transparent to-emerald-100/40">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-white/85 backdrop-blur-sm border border-teal-200/60 rounded-2xl p-8 md:p-14 text-center text-slate-800 shadow-sm shadow-teal-900/5"
          >
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Ready to Get Started?</h2>
              <p className="text-slate-600 text-lg">
                Join thousands who achieved their financial goals with CredFlow Finance.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                <Button
                  size="xl"
                  className="apply-btn-vibrate bg-teal-700 text-white hover:bg-teal-800 shadow-medium font-bold"
                  asChild
                >
                  <Link to="/login">
                    Apply for Loan
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="border-teal-600/30 text-teal-800 hover:bg-teal-50 bg-white"
                  asChild
                >
                  <Link to="/emi-calculator">Calculate EMI</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
