"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Globe,
  LineChart,
  Lock,
  Moon,
  PieChart,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/components/i18n-provider";
import { formatCurrency } from "@/lib/utils";

export function LandingPage() {
  const { t, locale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"revenue" | "inventory" | "health">("revenue");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const isAr = locale === "ar";

  const features = [
    {
      icon: Bot,
      title: isAr ? "مستشار الذكاء الاصطناعي" : "AI Business Advisor",
      desc: isAr
        ? "مساعد افتراضي يجيب على أسئلتك المالية والتشغيلية فوراً بالعربية والإنجليزية."
        : "Conversational assistant providing instant financial & operational insights in English & Arabic.",
      color: "from-indigo-500 to-purple-600",
    },
    {
      icon: LineChart,
      title: isAr ? "تحليلات مالية متقدمة" : "Advanced Financial Analytics",
      desc: isAr
        ? "مؤشرات أداء، رسوم بيانية تفاعلية، وتوقعات مستقبلية للإيرادات والأرباح الهامشية."
        : "Real-time KPIs, interactive charts, and predictive revenue forecasts.",
      color: "from-emerald-500 to-teal-600",
    },
    {
      icon: ShoppingBag,
      title: isAr ? "نظام مبيعات وفواتير متكامل" : "POS & Invoicing System",
      desc: isAr
        ? "إنشاء الفواتير، إدارة المرتجعات تلقائياً، وتحديث المخزون وإحصائيات العملاء."
        : "Full invoice workflow with automatic inventory restock and refund tracking.",
      color: "from-amber-500 to-orange-600",
    },
    {
      icon: Users,
      title: isAr ? "إدارة العلاقات والعملاء (CRM)" : "Customer CRM & Loyalty",
      desc: isAr
        ? "تصنيف العملاء، تتبع نقاط الولاء، وتحديد العملاء الأكثر عرضة للتوقف عن الشراء."
        : "Segment customers, track loyalty points, and identify churn risks automatically.",
      color: "from-rose-500 to-pink-600",
    },
    {
      icon: FileSpreadsheet,
      title: isAr ? "محلل المستندات الذكي" : "Smart Document Analyzer",
      desc: isAr
        ? "رفع ملفات Excel و CSV وتحليلها آلياً لاستخراج الإحصائيات والرؤى الهامة."
        : "Upload Excel & CSV spreadsheets for automated rule-based and AI data summaries.",
      color: "from-sky-500 to-blue-600",
    },
    {
      icon: Lock,
      title: isAr ? "صلاحيات متعددة وسجل مراجعة" : "Multi-Role RBAC & Audit",
      desc: isAr
        ? "5 مستويات من الصلاحيات (مالك، مدير، محاسب...) مع سجل أمان لكافة العمليات."
        : "5 role tiers (Owner, Admin, Manager, Accountant, Employee) with full audit logs.",
      color: "from-violet-500 to-indigo-600",
    },
  ];

  const pricingPlans = [
    {
      name: isAr ? "الأساسية" : "Starter",
      desc: isAr ? "مثالية للمشاريع الصغيرة والناشئة" : "Perfect for small businesses & startups",
      monthlyPrice: 0,
      yearlyPrice: 0,
      badge: isAr ? "مجاناً للأبد" : "Free Forever",
      features: isAr
        ? ["حساب لمستخدم واحد", "لوحة تحكم أساسية", "إدارة حتى 50 منتج", "مستشار ذكي محلي", "دعم عربي وإنجليزي"]
        : ["1 User Account", "Standard Dashboard", "Up to 50 Products", "Local AI Advisor", "Bilingual Support"],
      cta: isAr ? "ابدأ مجاناً" : "Get Started Free",
      popular: false,
    },
    {
      name: isAr ? "الاحترافية" : "Professional",
      desc: isAr ? "للشركات المتنامية التي تحتاج تحليلات عميقة" : "For growing businesses needing deeper intelligence",
      monthlyPrice: 29,
      yearlyPrice: 24,
      badge: isAr ? "الأكثر شعبية" : "Most Popular",
      features: isAr
        ? [
            "حتى 5 مستخدمين وصلاحيات متقدمة",
            "تحليلات وتوقعات غير محدودة",
            "منتجات وفواتير غير محدودة",
            "دمج خادم الذكاء الاصطناعي (Gemini / Ollama)",
            "تصدير تقارير CSV ومحلل المستندات",
            "سجل مراجعة الحسابات الكامل",
          ]
        : [
            "Up to 5 Users & Multi-Role RBAC",
            "Unlimited Forecasts & Analytics",
            "Unlimited Products & Sales",
            "Full LLM Integration (Gemini / Ollama)",
            "CSV Export & Smart File Analyzer",
            "Full Security Audit Trail",
          ],
      cta: isAr ? "ابدأ تجربتك المجانية" : "Start Free Trial",
      popular: true,
    },
    {
      name: isAr ? "المؤسسات" : "Enterprise",
      desc: isAr ? "حلول مخصصة للشركات الكبيرة والمستمرة" : "Customized solutions for larger organizations",
      monthlyPrice: 79,
      yearlyPrice: 65,
      badge: isAr ? "شامل كل شيء" : "All Inclusive",
      features: isAr
        ? [
            "عدد مستخدمين وفروع غير محدود",
            "مستشار ذكاء اصطناعي مخصص للشركة",
            "دعم فني أولوية 24/7",
            "ربط مباشر مع قواعد بيانات مخصصة",
            "استضافة خاصة (Self-Hosted Option)",
          ]
        : [
            "Unlimited Users & Multi-Branch",
            "Custom-Trained AI Advisor",
            "24/7 Dedicated Support",
            "Custom DB & API Integration",
            "Self-Hosted Option Available",
          ],
      cta: isAr ? "تواصل معنا" : "Contact Sales",
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans">
      {/* Dynamic Background Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 size-[600px] rounded-full bg-indigo-600/20 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 size-[500px] rounded-full bg-purple-600/15 blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 size-[600px] rounded-full bg-teal-600/10 blur-[160px]" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo light className="scale-110" />
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
              <a href="#features" className="hover:text-white transition-colors">
                {isAr ? "المميزات" : "Features"}
              </a>
              <a href="#demo" className="hover:text-white transition-colors">
                {isAr ? "الذكاء الاصطناعي" : "AI Advisor"}
              </a>
              <a href="#pricing" className="hover:text-white transition-colors">
                {isAr ? "الأسعار" : "Pricing"}
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle className="text-slate-300 hover:bg-slate-800" />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
            </button>
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-slate-200 hover:text-white transition-colors"
            >
              {t("auth.login.signIn")}
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>{isAr ? "إنشاء حساب مجاني" : "Get Started"}</span>
              <ChevronRight className={`size-4 ${isAr ? "rotate-180" : ""}`} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-24 md:pt-24 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wide uppercase mb-8 backdrop-blur-md">
          <Sparkles className="size-3.5 text-indigo-400 animate-pulse" />
          <span>{isAr ? "منصة ذكاء أعمال تفاعلية" : "Business Intelligence Platform"}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15] max-w-5xl mx-auto">
          {isAr ? (
            <>
              أدِر أرباحك ومبيعاتك <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">بذكاء اصطناعي فائق</span>
            </>
          ) : (
            <>
              Manage Your Business & Revenue <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">with Built-in AI</span>
            </>
          )}
        </h1>

        {/* Hero Description */}
        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
          {isAr
            ? "منصة متكاملة تجمع بين لوحات التحكم التحليلية، الفواتير، المخزون، ومستشار ذكاء اصطناعي يحلل بياناتك ويجيب على كافة استفساراتك الماليّة باللغة العربية والإنجليزيّة."
            : "Complete SaaS platform combining analytics dashboards, invoicing, CRM, inventory, and an AI Advisor that analyzes your data and answers financial questions in real-time."}
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white font-bold text-base shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <span>{isAr ? "تجربة المنصة مجاناً" : "Start Free Trial"}</span>
            <ArrowRight className={`size-5 ${isAr ? "rotate-180" : ""}`} />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold text-base backdrop-blur-md transition-all flex items-center justify-center gap-2"
          >
            <Zap className="size-5 text-amber-400" />
            <span>{isAr ? "تجربة الحساب العرضي (Demo)" : "Try Demo Accounts"}</span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>{isAr ? "بدون بطاقة ائتمان" : "No Credit Card Required"}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>{isAr ? "دعم كامل للغة العربية (RTL)" : "Full Arabic & English (RTL/LTR)"}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>{isAr ? "نموذج ذكاء اصطناعي مدمج" : "Built-in AI Analytics"}</span>
          </div>
        </div>

        {/* Interactive Interactive Preview Container */}
        <div className="mt-16 relative mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-indigo-950/80 overflow-hidden backdrop-blur-xl">
          {/* Mock App Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-rose-500/80" />
                <div className="size-3 rounded-full bg-amber-500/80" />
                <div className="size-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400 border-l border-slate-800 pl-3 ms-2">
                business-ai.app/dashboard
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">
                <span className="size-1.5 rounded-full bg-indigo-400" />
                {isAr ? "معاينة المنتج" : "Product Preview"}
              </span>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3 gap-4">
            <button
              onClick={() => setActiveTab("revenue")}
              className={`pb-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === "revenue"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {isAr ? "الإيرادات والأرباح" : "Revenue & Profit"}
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`pb-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === "inventory"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {isAr ? "المخزون والمبيعات" : "Stock & Sales"}
            </button>
            <button
              onClick={() => setActiveTab("health")}
              className={`pb-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === "health"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {isAr ? "صحة الأعمال (Health Score)" : "Business Health"}
            </button>
          </div>

          {/* Interactive Card Body Preview */}
          <div className="p-6 md:p-8">
            {activeTab === "revenue" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-start">
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                    {isAr ? "إجمالي الإيرادات" : "Total Revenue"}
                  </span>
                  <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(48250, "USD", false, locale)}</div>
                  <span className="mt-2 inline-block text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    +18.4% vs last month
                  </span>
                </div>
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                    {isAr ? "صافي الربح" : "Net Profit"}
                  </span>
                  <div className="mt-2 text-2xl font-bold text-emerald-400">{formatCurrency(19400, "USD", false, locale)}</div>
                  <span className="mt-2 inline-block text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    40.2% Net Margin
                  </span>
                </div>
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                    {isAr ? "توقعات الإيرادات" : "Revenue Forecast"}
                  </span>
                  <div className="mt-2 text-2xl font-bold text-purple-400">{formatCurrency(54100, "USD", false, locale)}</div>
                  <span className="mt-2 inline-block text-xs font-semibold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded">
                    {isAr ? "بناءً على البيانات التاريخية" : "Based on historical data"}
                  </span>
                </div>
              </div>
            )}

            {activeTab === "inventory" && (
              <div className="space-y-4 text-start">
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div>
                    <h4 className="font-semibold text-white">MacBook Pro M3 Max</h4>
                    <p className="text-xs text-slate-400">SKU: PRO-M3-01 · Category: Electronics</p>
                  </div>
                  <div className="text-end">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Stock OK (42 pcs)
                    </span>
                    <p className="text-xs text-slate-400 mt-1">$2,499.00 / unit</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div>
                    <h4 className="font-semibold text-white">Wireless Noise-Canceling Headphones</h4>
                    <p className="text-xs text-slate-400">SKU: AUD-HD-99 · Category: Audio</p>
                  </div>
                  <div className="text-end">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Low Stock Alert (3 pcs)
                    </span>
                    <p className="text-xs text-slate-400 mt-1">$349.00 / unit</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "health" && (
              <div className="flex flex-col md:flex-row items-center gap-8 text-start p-4">
                <div className="relative size-32 rounded-full border-8 border-indigo-500/30 flex items-center justify-center bg-slate-950">
                  <div className="text-center">
                    <span className="text-3xl font-extrabold text-white">88</span>
                    <span className="block text-[10px] uppercase font-semibold text-emerald-400">Strong</span>
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="text-lg font-bold text-white">
                    {isAr ? "مؤشر صحة الشركة ممتاز (88/100)" : "Business Health Rating: Strong (88/100)"}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {isAr
                      ? "نسبة السيولة ممتازة والهوامش الربحية متوازنة. يوجد 2 من العملاء الكبار لم يقوموا بالشراء منذ 45 يوماً."
                      : "Liquidity ratio is optimal and gross margins are stable. 2 key accounts inactive over 45 days."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="relative z-10 py-20 bg-slate-900/50 border-y border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              {isAr ? "كل ما تحتاجه لإدارة أعمالك" : "Everything You Need to Run Your Business"}
            </h2>
            <p className="mt-4 text-slate-400 text-lg">
              {isAr
                ? "نظام متكامل مصمم لتقديم أداء سريع وأدوات تحليلية دقيقة تمنحك الرؤية الكاملة لمشروعك."
                : "Comprehensive tools designed to deliver fast, reliable, and data-backed decision making."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-8 rounded-2xl border border-slate-800 bg-slate-950/80 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all text-start group"
              >
                <div
                  className={`size-12 rounded-xl bg-gradient-to-r ${f.color} flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}
                >
                  <f.icon className="size-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive AI Advisor Demo Section */}
      <section id="demo" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 p-8 md:p-12 backdrop-blur-xl relative overflow-hidden">
          <div className="max-w-3xl text-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4 border border-indigo-500/30">
              <Bot className="size-4 text-indigo-400" />
              <span>{isAr ? "مستشار الذكاء الاصطناعي التفاعلي" : "AI Advisor Interactive Demo"}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              {isAr ? "اسأل المستشار أي سؤال باللغة العربية" : "Ask the AI Advisor Any Question in Plain Language"}
            </h2>
            <p className="mt-3 text-slate-300 text-base">
              {isAr
                ? "حلل الإيرادات، اكتشف سبب انخفاض الأرباح، أو اعرف المنتجات الأعلى مبيعاً في ثوانٍ معدودة."
                : "Get natural language breakdowns of your sales trends, high-margin products, and expense spikes."}
            </p>

            {/* Chat Box Mockup */}
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0 font-mono text-xs">
                  YOU
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-900 text-sm text-slate-200 border border-slate-800">
                  {isAr ? "ما هي أكثر المنتجات تحقيقاً للأرباح هذا الشهر؟" : "What are our top most profitable products this month?"}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                  <Brain className="size-4" />
                </div>
                <div className="p-4 rounded-2xl rounded-tr-none bg-indigo-950/50 text-sm text-slate-200 border border-indigo-500/30 space-y-2">
                  <p className="font-semibold text-indigo-300">
                    {isAr
                      ? "بناءً على تحليل بيانات المبيعات الحالية، إليك المنتجات الأعلى هامش ربح:"
                      : "Based on real-time sales ledger analysis, here are your highest margin items:"}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>MacBook Pro M3 (هامش ربح 38% · $950/وحدة)</li>
                    <li>Wireless Headphones (هامش ربح 52% · $180/وحدة)</li>
                  </ul>
                  <div className="mt-2 pt-2 border-t border-indigo-500/20 text-xs text-indigo-400 font-mono">
                    ✓ {isAr ? "تحليل البيانات بنجاح" : "Analyzed from sales data"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-20 bg-slate-900/40 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              {isAr ? "خطط أسعار بسيطة" : "Simple Pricing"}
            </h2>
            <p className="mt-4 text-slate-400 text-lg">
              {isAr ? "ابدأ مجاناً وقم بالترقية عندما تكبر أعمالك." : "Start free forever. Upgrade as your team and volume grow."}
            </p>

            {/* Monthly / Yearly Toggle */}
            <div className="mt-8 inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  billingCycle === "monthly" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isAr ? "شهري" : "Monthly"}
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  billingCycle === "yearly" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{isAr ? "سنوي" : "Yearly"}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px]">
                  {isAr ? "خصم 17%" : "Save 17%"}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-3xl p-8 flex flex-col justify-between border text-start transition-all relative ${
                  plan.popular
                    ? "bg-slate-900 border-indigo-500 shadow-2xl shadow-indigo-500/20 scale-[1.03]"
                    : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold uppercase tracking-wider shadow">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-2 min-h-[32px]">{plan.desc}</p>

                  <div className="my-6">
                    <span className="text-4xl font-extrabold text-white">
                      ${billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                    </span>
                    <span className="text-sm text-slate-400 ms-2">/{isAr ? "شهر" : "mo"}</span>
                  </div>

                  <ul className="space-y-3 border-t border-slate-800 pt-6 text-sm text-slate-300">
                    {plan.features.map((feat, fi) => (
                      <li key={fi} className="flex items-center gap-2.5">
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800/60">
                  <Link
                    href="/register"
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${
                      plan.popular
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Logo light />
          <p>© {new Date().getFullYear()} Business AI. All rights reserved. <span className="font-semibold text-slate-300">By Zaiedd</span></p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white transition-colors">
              {t("auth.login.title")}
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              {t("auth.register.title")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
