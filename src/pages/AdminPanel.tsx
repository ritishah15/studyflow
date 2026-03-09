import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, BarChart3, Shield, LogOut, Eye, TrendingUp, Loader2,
  BookOpen, Target, FileText, Activity, Home, Bell, Search,
  ArrowUpRight, ArrowDownRight, Clock, Zap, Brain, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  Legend, AreaChart, Area,
} from "recharts";

const CHART_COLORS = [
  "hsl(160,84%,44%)",
  "hsl(200,80%,55%)",
  "hsl(38,92%,55%)",
  "hsl(280,70%,60%)",
  "hsl(0,72%,55%)",
];

const TOOLTIP_STYLE = {
  background: "hsl(220,18%,10%)",
  border: "1px solid hsl(220,14%,18%)",
  borderRadius: 8,
  color: "hsl(210,20%,95%)",
  fontSize: 12,
};

type Section = "overview" | "users" | "engagement" | "content" | "earnings";

const navItems: { id: Section; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "users", label: "Users", icon: Users },
  { id: "engagement", label: "Engagement", icon: Activity },
  { id: "content", label: "Content", icon: BookOpen },
  { id: "earnings", label: "Earnings", icon: TrendingUp },
];

const AdminPanel = () => {
  const [section, setSection] = useState<Section>("overview");
  const [students, setStudents] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Auth guard — check sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") !== "true") {
      navigate("/admin-login");
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    const [profilesRes, quizzesRes, sessionsRes, summariesRes, flashcardsRes, subsRes] =
      await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("quiz_results").select("*"),
        supabase.from("study_sessions").select("*"),
        supabase.from("summaries").select("*"),
        supabase.from("flashcard_sets").select("*"),
        supabase.from("subscriptions").select("*"),
      ]);

    setStudents(profilesRes.data || []);
    setQuizzes(quizzesRes.data || []);
    setSessions(sessionsRes.data || []);
    setSummaries(summariesRes.data || []);
    setFlashcardSets(flashcardsRes.data || []);
    setSubscriptions(subsRes.data || []);
    setLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    navigate("/admin-login");
  };

  // ── Derived stats ──────────────────────────────────────────
  const totalUsers = students.length;
  const activeToday = students.filter(
    (p) => p.last_active && new Date(p.last_active) > new Date(Date.now() - 86400000)
  ).length;
  const activeThisWeek = students.filter(
    (p) => p.last_active && new Date(p.last_active) > new Date(Date.now() - 7 * 86400000)
  ).length;
  const avgFocus =
    sessions.length > 0
      ? Math.round(sessions.reduce((a, s) => a + (s.focus_score || 0), 0) / sessions.length)
      : 0;
  const totalStudySeconds = sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0);
  const totalStudyHours = Math.round(totalStudySeconds / 3600);
  const avgQuizScore =
    quizzes.length > 0
      ? Math.round(
          quizzes.reduce((a, q) => a + (q.score / q.total_questions) * 100, 0) / quizzes.length
        )
      : 0;

  // Earnings (from subscriptions)
  const proSubs = subscriptions.filter((s) => s.plan === "pro" && s.status === "active").length;
  const premiumSubs = subscriptions.filter((s) => s.plan === "premium" && s.status === "active").length;
  const totalEarnings = proSubs * 199 + premiumSubs * 499;
  const paidUsers = subscriptions.filter((s) => s.plan !== "free" && s.status === "active").length;

  // Per-student stats
  const perStudent: Record<string, any> = {};
  students.forEach((p) => {
    const uq = quizzes.filter((q) => q.user_id === p.user_id);
    const us = sessions.filter((s) => s.user_id === p.user_id);
    const uss = summaries.filter((s) => s.user_id === p.user_id);
    const sub = subscriptions.find((s) => s.user_id === p.user_id);
    perStudent[p.user_id] = {
      quizzes: uq.length,
      avgScore:
        uq.length > 0
          ? Math.round(uq.reduce((a, q) => a + (q.score / q.total_questions) * 100, 0) / uq.length)
          : 0,
      sessions: us.length,
      avgFocus:
        us.length > 0
          ? Math.round(us.reduce((a, s) => a + (s.focus_score || 0), 0) / us.length)
          : 0,
      summaries: uss.length,
      plan: sub?.plan || "free",
      studyHours: Math.round(us.reduce((a, s) => a + (s.duration_seconds || 0), 0) / 3600),
    };
  });

  // Engagement by day (last 7 days)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay: Record<string, { sessions: number; quizzes: number; summaries: number }> = {};
  days.forEach((d) => (byDay[d] = { sessions: 0, quizzes: 0, summaries: 0 }));
  sessions
    .filter((s) => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000))
    .forEach((s) => { const d = days[new Date(s.created_at).getDay()]; byDay[d].sessions++; });
  quizzes
    .filter((q) => new Date(q.created_at) > new Date(Date.now() - 7 * 86400000))
    .forEach((q) => { const d = days[new Date(q.created_at).getDay()]; byDay[d].quizzes++; });
  summaries
    .filter((s) => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000))
    .forEach((s) => { const d = days[new Date(s.created_at).getDay()]; byDay[d].summaries++; });
  const engagementData = days.map((d) => ({ day: d, ...byDay[d] }));

  // User growth (cumulative by week)
  const weekMap: Record<string, number> = {};
  students.forEach((p) => {
    const d = new Date(p.created_at);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
      .toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weekMap[key] = (weekMap[key] || 0) + 1;
  });
  let cum = 0;
  const growthData = Object.entries(weekMap).map(([week, count]) => {
    cum += count;
    return { week, users: cum };
  });

  // Focus distribution
  const focusBuckets = [
    { name: "Excellent 90%+", value: 0 },
    { name: "Good 70-89%", value: 0 },
    { name: "Average 50-69%", value: 0 },
    { name: "Needs Help <50%", value: 0 },
  ];
  sessions.forEach((s) => {
    const f = s.focus_score || 0;
    if (f >= 90) focusBuckets[0].value++;
    else if (f >= 70) focusBuckets[1].value++;
    else if (f >= 50) focusBuckets[2].value++;
    else focusBuckets[3].value++;
  });
  const focusDist = focusBuckets.filter((b) => b.value > 0);

  // Plan distribution
  const planDist = [
    { name: "Free", value: subscriptions.filter((s) => s.plan === "free").length || totalUsers - paidUsers },
    { name: "Pro", value: proSubs },
    { name: "Premium", value: premiumSubs },
  ].filter((p) => p.value > 0);

  // Monthly earnings (mock trend based on subscriptions)
  const earningsTrend = growthData.map((g, i) => ({
    week: g.week,
    earnings: Math.max(0, (proSubs * 199 + premiumSubs * 499) * ((i + 1) / Math.max(growthData.length, 1))),
  }));

  // Filtered students for user table
  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  });

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-60 border-r border-border/50 bg-card/30 backdrop-blur-sm flex flex-col fixed h-full z-20">
        {/* Logo */}
        <div className="p-4 border-b border-border/50">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold gradient-text">StudyFlow AI</span>
          </Link>
          <div className="flex items-center gap-1.5 mt-2 px-1">
            <Shield className="h-3 w-3 text-accent" />
            <span className="text-xs text-accent font-medium">Admin Panel</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                section === item.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {section === item.id && <ChevronRight className="ml-auto h-3 w-3" />}
            </button>
          ))}
        </nav>

        {/* Stats summary in sidebar */}
        <div className="p-3 border-t border-border/50 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-lg font-bold text-primary">{totalUsers}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground">Total Earnings</p>
            <p className="text-lg font-bold text-accent">₹{totalEarnings.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────── */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm h-14 flex items-center px-6 gap-4">
          <div className="flex-1">
            <h1 className="text-base font-semibold capitalize">{section}</h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-48 bg-secondary border-border text-sm"
                onFocus={() => setSection("users")}
              />
            </div>
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">

          {/* ══ OVERVIEW ══════════════════════════════════════ */}
          {section === "overview" && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Users",
                    value: totalUsers,
                    sub: `${activeToday} active today`,
                    icon: Users,
                    color: "text-primary",
                    bg: "bg-primary/10",
                    trend: "up",
                  },
                  {
                    label: "Total Sessions",
                    value: sessions.length,
                    sub: `${totalStudyHours}h total study`,
                    icon: Target,
                    color: "text-chart-2",
                    bg: "bg-chart-2/10",
                    trend: "up",
                  },
                  {
                    label: "Avg Focus Score",
                    value: `${avgFocus}%`,
                    sub: `${sessions.length} sessions tracked`,
                    icon: Activity,
                    color: "text-chart-3",
                    bg: "bg-chart-3/10",
                    trend: avgFocus >= 70 ? "up" : "down",
                  },
                  {
                    label: "Total Earnings",
                    value: `₹${totalEarnings.toLocaleString("en-IN")}`,
                    sub: `${paidUsers} paid users`,
                    icon: TrendingUp,
                    color: "text-accent",
                    bg: "bg-accent/10",
                    trend: "up",
                  },
                ].map((card) => (
                  <div key={card.label} className="glass-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                        <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
                      </div>
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${card.trend === "up" ? "text-primary" : "text-destructive"}`}>
                        {card.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      </span>
                    </div>
                    <p className="text-2xl font-bold mb-0.5">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Quizzes Taken", value: quizzes.length, icon: Zap, color: "text-chart-4" },
                  { label: "Summaries Created", value: summaries.length, icon: FileText, color: "text-primary" },
                  { label: "Flashcard Sets", value: flashcardSets.length, icon: BookOpen, color: "text-chart-2" },
                  { label: "Avg Quiz Score", value: `${avgQuizScore}%`, icon: BarChart3, color: "text-chart-3" },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">User Growth</h3>
                  <p className="text-xs text-muted-foreground mb-4">Cumulative registered users over time</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={growthData}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160,84%,44%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(160,84%,44%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                      <XAxis dataKey="week" stroke="hsl(215,12%,55%)" fontSize={11} />
                      <YAxis stroke="hsl(215,12%,55%)" fontSize={11} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="users" stroke="hsl(160,84%,44%)" strokeWidth={2.5} fill="url(#colorUsers)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Weekly Engagement</h3>
                  <p className="text-xs text-muted-foreground mb-4">Sessions, quizzes & summaries last 7 days</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                      <XAxis dataKey="day" stroke="hsl(215,12%,55%)" fontSize={11} />
                      <YAxis stroke="hsl(215,12%,55%)" fontSize={11} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="sessions" fill="hsl(160,84%,44%)" radius={[3,3,0,0]} name="Sessions" />
                      <Bar dataKey="quizzes" fill="hsl(200,80%,55%)" radius={[3,3,0,0]} name="Quizzes" />
                      <Bar dataKey="summaries" fill="hsl(38,92%,55%)" radius={[3,3,0,0]} name="Summaries" />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent users */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Recent Signups</h3>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setSection("users")}>
                    View all <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {students.slice(-5).reverse().map((s) => {
                    const st = perStudent[s.user_id] || {};
                    return (
                      <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {(s.full_name || s.email || "U")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            st.plan === "premium" ? "bg-chart-3/20 text-chart-3" :
                            st.plan === "pro" ? "bg-primary/20 text-primary" :
                            "bg-secondary text-muted-foreground"
                          }`}>{st.plan || "free"}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══ USERS ══════════════════════════════════════════ */}
          {section === "users" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                {[
                  { label: "Total Users", value: totalUsers, color: "text-primary" },
                  { label: "Active Today", value: activeToday, color: "text-chart-2" },
                  { label: "Active This Week", value: activeThisWeek, color: "text-chart-3" },
                  { label: "Paid Users", value: paidUsers, color: "text-accent" },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> All Users ({filteredStudents.length})
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 w-48 bg-secondary border-border text-sm"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["User", "Email", "Joined", "Plan", "Quizzes", "Avg Score", "Sessions", "Study Time", "Focus", "Summaries", "Last Active"].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-muted-foreground font-medium text-xs whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr><td colSpan={11} className="py-8 text-center text-muted-foreground">No users found</td></tr>
                      ) : filteredStudents.map((s) => {
                        const st = perStudent[s.user_id] || {};
                        const isActive = s.last_active && new Date(s.last_active) > new Date(Date.now() - 86400000);
                        return (
                          <tr key={s.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                  {(s.full_name || s.email || "U")[0].toUpperCase()}
                                </div>
                                <span className="font-medium whitespace-nowrap">{s.full_name || "Unknown"}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{s.email || "—"}</td>
                            <td className="py-3 px-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("en-IN")}</td>
                            <td className="py-3 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                st.plan === "premium" ? "bg-chart-3/20 text-chart-3" :
                                st.plan === "pro" ? "bg-primary/20 text-primary" :
                                "bg-secondary text-muted-foreground"
                              }`}>{st.plan || "free"}</span>
                            </td>
                            <td className="py-3 px-3 text-center">{st.quizzes ?? 0}</td>
                            <td className="py-3 px-3">
                              <span className={`font-medium ${(st.avgScore ?? 0) >= 70 ? "text-primary" : "text-destructive"}`}>
                                {st.avgScore ?? 0}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">{st.sessions ?? 0}</td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{st.studyHours ?? 0}h</td>
                            <td className="py-3 px-3">
                              <span className={`font-medium ${(st.avgFocus ?? 0) >= 70 ? "text-primary" : "text-destructive"}`}>
                                {st.avgFocus ?? 0}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">{st.summaries ?? 0}</td>
                            <td className="py-3 px-3">
                              <span className={`flex items-center gap-1 text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                                {s.last_active ? new Date(s.last_active).toLocaleDateString("en-IN") : "Never"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ ENGAGEMENT ══════════════════════════════════════ */}
          {section === "engagement" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Study Hours", value: `${totalStudyHours}h`, icon: Clock, color: "text-primary" },
                  { label: "Total Sessions", value: sessions.length, icon: Target, color: "text-chart-2" },
                  { label: "Avg Focus Score", value: `${avgFocus}%`, icon: Activity, color: "text-chart-3" },
                  { label: "Avg Quiz Score", value: `${avgQuizScore}%`, icon: Zap, color: "text-chart-4" },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Daily Activity (Last 7 Days)</h3>
                  <p className="text-xs text-muted-foreground mb-4">Sessions, quizzes and summaries per day</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                      <XAxis dataKey="day" stroke="hsl(215,12%,55%)" fontSize={11} />
                      <YAxis stroke="hsl(215,12%,55%)" fontSize={11} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="sessions" fill="hsl(160,84%,44%)" radius={[3,3,0,0]} name="Sessions" />
                      <Bar dataKey="quizzes" fill="hsl(200,80%,55%)" radius={[3,3,0,0]} name="Quizzes" />
                      <Bar dataKey="summaries" fill="hsl(38,92%,55%)" radius={[3,3,0,0]} name="Summaries" />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Focus Score Distribution</h3>
                  <p className="text-xs text-muted-foreground mb-4">How focused users are during sessions</p>
                  {focusDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={focusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                          {focusDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">No session data yet</div>
                  )}
                </div>
              </div>

              {/* Top users by study time */}
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Top Users by Study Time</h3>
                <div className="space-y-3">
                  {students
                    .sort((a, b) => (perStudent[b.user_id]?.studyHours || 0) - (perStudent[a.user_id]?.studyHours || 0))
                    .slice(0, 8)
                    .map((s, i) => {
                      const st = perStudent[s.user_id] || {};
                      const maxHours = perStudent[students[0]?.user_id]?.studyHours || 1;
                      return (
                        <div key={s.id} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {(s.full_name || s.email || "U")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{s.full_name || s.email || "Unknown"}</span>
                              <span className="text-xs text-muted-foreground ml-2 shrink-0">{st.studyHours ?? 0}h</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(2, ((st.studyHours || 0) / maxHours) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {students.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>}
                </div>
              </div>
            </>
          )}

          {/* ══ CONTENT ══════════════════════════════════════════ */}
          {section === "content" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Quizzes", value: quizzes.length, icon: Zap, color: "text-chart-4" },
                  { label: "Total Summaries", value: summaries.length, icon: FileText, color: "text-primary" },
                  { label: "Flashcard Sets", value: flashcardSets.length, icon: BookOpen, color: "text-chart-2" },
                  { label: "Avg Quiz Score", value: `${avgQuizScore}%`, icon: BarChart3, color: "text-chart-3" },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Quiz score distribution */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Quiz Score Distribution</h3>
                  <p className="text-xs text-muted-foreground mb-4">Breakdown of all quiz results</p>
                  {(() => {
                    const buckets = [
                      { name: "90-100%", value: quizzes.filter(q => (q.score / q.total_questions) * 100 >= 90).length },
                      { name: "70-89%", value: quizzes.filter(q => { const s = (q.score / q.total_questions) * 100; return s >= 70 && s < 90; }).length },
                      { name: "50-69%", value: quizzes.filter(q => { const s = (q.score / q.total_questions) * 100; return s >= 50 && s < 70; }).length },
                      { name: "Below 50%", value: quizzes.filter(q => (q.score / q.total_questions) * 100 < 50).length },
                    ].filter(b => b.value > 0);
                    return buckets.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={buckets} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={3}>
                            {buckets.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No quiz data yet</div>
                    );
                  })()}
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Content Usage</h3>
                  <p className="text-xs text-muted-foreground mb-4">Which features students use most</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[
                      { name: "Quizzes", count: quizzes.length },
                      { name: "Summaries", count: summaries.length },
                      { name: "Flashcards", count: flashcardSets.length },
                      { name: "Sessions", count: sessions.length },
                    ]} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                      <XAxis type="number" stroke="hsl(215,12%,55%)" fontSize={11} />
                      <YAxis dataKey="name" type="category" stroke="hsl(215,12%,55%)" fontSize={11} width={70} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="hsl(160,84%,44%)" radius={[0,3,3,0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Most active topics from quizzes */}
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Recent Quiz Topics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Topic", "User", "Score", "Date"].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quizzes.slice(-20).reverse().map((q, i) => {
                        const user = students.find(s => s.user_id === q.user_id);
                        const pct = Math.round((q.score / q.total_questions) * 100);
                        return (
                          <tr key={i} className="border-b border-border/30 hover:bg-secondary/30">
                            <td className="py-2.5 px-3 font-medium">{q.topic || "—"}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{user?.full_name || user?.email || "Unknown"}</td>
                            <td className="py-2.5 px-3">
                              <span className={`font-medium ${pct >= 70 ? "text-primary" : "text-destructive"}`}>{pct}%</span>
                              <span className="text-muted-foreground text-xs ml-1">({q.score}/{q.total_questions})</span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{new Date(q.created_at).toLocaleDateString("en-IN")}</td>
                          </tr>
                        );
                      })}
                      {quizzes.length === 0 && (
                        <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No quizzes yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ EARNINGS ══════════════════════════════════════════ */}
          {section === "earnings" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Earnings", value: `₹${totalEarnings.toLocaleString("en-IN")}`, color: "text-accent", sub: "All time" },
                  { label: "Pro Subscribers", value: proSubs, color: "text-primary", sub: "₹199/mo each" },
                  { label: "Premium Subscribers", value: premiumSubs, color: "text-chart-3", sub: "₹499/mo each" },
                  { label: "Conversion Rate", value: totalUsers > 0 ? `${Math.round((paidUsers / totalUsers) * 100)}%` : "0%", color: "text-chart-2", sub: `${paidUsers} of ${totalUsers} users` },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-5">
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Earnings Trend</h3>
                  <p className="text-xs text-muted-foreground mb-4">Cumulative revenue over time</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={earningsTrend}>
                      <defs>
                        <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(38,92%,55%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(38,92%,55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                      <XAxis dataKey="week" stroke="hsl(215,12%,55%)" fontSize={11} />
                      <YAxis stroke="hsl(215,12%,55%)" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`₹${Math.round(v)}`, "Earnings"]} />
                      <Area type="monotone" dataKey="earnings" stroke="hsl(38,92%,55%)" strokeWidth={2.5} fill="url(#colorEarnings)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-1">Plan Distribution</h3>
                  <p className="text-xs text-muted-foreground mb-4">Breakdown of active subscriptions</p>
                  {planDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie data={planDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                          {planDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[230px] flex items-center justify-center text-muted-foreground text-sm">No subscription data yet</div>
                  )}
                </div>
              </div>

              {/* Subscribers table */}
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" /> Paid Subscribers
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["User", "Email", "Plan", "Amount", "Started", "Expires", "Status"].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-muted-foreground font-medium text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.filter(s => s.plan !== "free").length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No paid subscribers yet</td></tr>
                      ) : subscriptions.filter(s => s.plan !== "free").map((sub, i) => {
                        const user = students.find(s => s.user_id === sub.user_id);
                        const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
                        return (
                          <tr key={i} className="border-b border-border/30 hover:bg-secondary/30">
                            <td className="py-2.5 px-3 font-medium">{user?.full_name || "Unknown"}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{user?.email || "—"}</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                sub.plan === "premium" ? "bg-chart-3/20 text-chart-3" : "bg-primary/20 text-primary"
                              }`}>{sub.plan}</span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-accent">₹{sub.plan === "pro" ? 199 : 499}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">{new Date(sub.started_at).toLocaleDateString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">
                              {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                isExpired ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"
                              }`}>
                                {isExpired ? "Expired" : "Active"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </main>

        {/* ── Footer ─────────────────────────────────── */}
        <footer className="border-t border-border/50 px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span>StudyFlow AI Admin Panel</span>
          </div>
          <span>© 2026 StudyFlow AI. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
};

export default AdminPanel;