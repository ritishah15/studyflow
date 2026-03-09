import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, BarChart3, Shield, ArrowLeft, Eye, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const CHART_COLORS = ["hsl(160,84%,44%)", "hsl(200,80%,55%)", "hsl(38,92%,55%)", "hsl(280,70%,60%)", "hsl(0,72%,55%)"];

const AdminPanel = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<Record<string, { quizzes: number; avgScore: number; sessions: number; avgFocus: number }>>({});
  const [stats, setStats] = useState({ total: 0, active: 0, avgFocus: 0, totalQuizzes: 0 });
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [focusDistribution, setFocusDistribution] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin-login"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!roles?.some((r: any) => r.role === "admin")) {
        toast({ title: "Access denied", variant: "destructive" }); navigate("/dashboard"); return;
      }

      // Fetch all data in parallel
      const [profilesRes, quizzesRes, sessionsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("quiz_results").select("*"),
        supabase.from("study_sessions").select("*"),
      ]);

      const profiles = profilesRes.data || [];
      const quizzes = quizzesRes.data || [];
      const sessions = sessionsRes.data || [];

      setStudents(profiles);

      // Per-student stats
      const perStudent: Record<string, { quizzes: number; avgScore: number; sessions: number; avgFocus: number }> = {};
      profiles.forEach((p: any) => {
        const uq = quizzes.filter((q: any) => q.user_id === p.user_id);
        const us = sessions.filter((s: any) => s.user_id === p.user_id);
        perStudent[p.user_id] = {
          quizzes: uq.length,
          avgScore: uq.length > 0 ? Math.round(uq.reduce((a: number, q: any) => a + (q.score / q.total_questions) * 100, 0) / uq.length) : 0,
          sessions: us.length,
          avgFocus: us.length > 0 ? Math.round(us.reduce((a: number, s: any) => a + (s.focus_score || 0), 0) / us.length) : 0,
        };
      });
      setStudentStats(perStudent);

      // Aggregates
      const activeToday = profiles.filter((p: any) => p.last_active && new Date(p.last_active) > new Date(Date.now() - 86400000)).length;
      const allFocus = sessions.length > 0 ? Math.round(sessions.reduce((a: number, s: any) => a + (s.focus_score || 0), 0) / sessions.length) : 0;
      setStats({ total: profiles.length, active: activeToday, avgFocus: allFocus, totalQuizzes: quizzes.length });

      // Engagement by day (last 7 days)
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const last7Sessions = sessions.filter((s: any) => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000));
      const last7Quizzes = quizzes.filter((q: any) => new Date(q.created_at) > new Date(Date.now() - 7 * 86400000));
      const byDay: Record<string, { sessions: number; quizzes: number }> = {};
      days.forEach((d) => (byDay[d] = { sessions: 0, quizzes: 0 }));
      last7Sessions.forEach((s: any) => { const d = days[new Date(s.created_at).getDay()]; byDay[d].sessions++; });
      last7Quizzes.forEach((q: any) => { const d = days[new Date(q.created_at).getDay()]; byDay[d].quizzes++; });
      setEngagementData(days.map((d) => ({ day: d, ...byDay[d] })));

      // Focus distribution
      const focusBuckets = [
        { name: "Excellent (90%+)", value: 0 }, { name: "Good (70-89%)", value: 0 },
        { name: "Average (50-69%)", value: 0 }, { name: "Needs Help (<50%)", value: 0 },
      ];
      sessions.forEach((s: any) => {
        const f = s.focus_score || 0;
        if (f >= 90) focusBuckets[0].value++;
        else if (f >= 70) focusBuckets[1].value++;
        else if (f >= 50) focusBuckets[2].value++;
        else focusBuckets[3].value++;
      });
      setFocusDistribution(focusBuckets.filter((b) => b.value > 0));

      // User growth over time (group by week of signup)
      const weekMap: Record<string, number> = {};
      profiles.forEach((p: any) => {
        const d = new Date(p.created_at);
        const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
        const key = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        weekMap[key] = (weekMap[key] || 0) + 1;
      });
      let cumulative = 0;
      setGrowthData(Object.entries(weekMap).map(([week, count]) => {
        cumulative += count;
        return { week, users: cumulative };
      }));

      setLoading(false);
    };
    loadAdmin();
  }, [navigate, toast]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-accent" /><span className="font-bold text-lg">Admin Panel</span></div>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Students", value: stats.total, icon: Users, color: "text-primary" },
            { label: "Active Today", value: stats.active, icon: Eye, color: "text-chart-2" },
            { label: "Avg Focus Score", value: `${stats.avgFocus}%`, icon: TrendingUp, color: "text-chart-3" },
            { label: "Total Quizzes", value: stats.totalQuizzes, icon: BarChart3, color: "text-chart-4" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-5">
              <div className="flex items-center justify-between mb-2"><span className="text-sm text-muted-foreground">{s.label}</span><s.icon className={`h-4 w-4 ${s.color}`} /></div>
              <p className="text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Weekly Engagement</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                <XAxis dataKey="day" stroke="hsl(215,12%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,12%,55%)" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
                <Bar dataKey="sessions" fill="hsl(160,84%,44%)" radius={[4,4,0,0]} name="Sessions" />
                <Bar dataKey="quizzes" fill="hsl(200,80%,55%)" radius={[4,4,0,0]} name="Quizzes" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Focus Score Distribution</h3>
            {focusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={focusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${value}`}>
                    {focusDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No session data yet</div>
            )}
          </div>

          <div className="glass-card p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">User Growth</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                <XAxis dataKey="week" stroke="hsl(215,12%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,12%,55%)" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="users" stroke="hsl(160,84%,44%)" strokeWidth={3} dot={{ fill: "hsl(160,84%,44%)", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> All Students</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Joined</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Quizzes</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Avg Score</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Sessions</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Focus</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No students registered yet</td></tr>
                ) : students.map((s: any) => {
                  const st = studentStats[s.user_id] || { quizzes: 0, avgScore: 0, sessions: 0, avgFocus: 0 };
                  return (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-3 px-4 font-medium">{s.full_name || "Unknown"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{s.email || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{st.quizzes}</td>
                      <td className="py-3 px-4"><span className={st.avgScore >= 70 ? "text-primary" : "text-destructive"}>{st.avgScore}%</span></td>
                      <td className="py-3 px-4">{st.sessions}</td>
                      <td className="py-3 px-4"><span className={st.avgFocus >= 70 ? "text-primary" : "text-destructive"}>{st.avgFocus}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
