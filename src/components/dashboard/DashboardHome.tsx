import { useState, useEffect } from "react";
import { BookOpen, Target, Zap, TrendingUp, Clock, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const DashboardHome = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: "Study Hours", value: "0h", icon: Clock, change: "+0h", color: "text-primary" },
    { label: "Quizzes Taken", value: "0", icon: Zap, change: "+0", color: "text-chart-2" },
    { label: "Focus Score", value: "—", icon: Target, change: "—", color: "text-chart-3" },
    { label: "Topics Covered", value: "0", icon: BookOpen, change: "+0", color: "text-chart-4" },
  ]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;

        const [quizRes, sessionRes] = await Promise.all([
          supabase.from("quiz_results").select("*").eq("user_id", uid),
          supabase.from("study_sessions").select("*").eq("user_id", uid),
        ]);

        const quizzes = quizRes.data || [];
        const sessions = sessionRes.data || [];

        const totalMinutes = sessions.reduce((a, s) => a + s.duration_seconds / 60, 0);
        const avgFocus = sessions.length > 0 ? Math.round(sessions.reduce((a, s) => a + (s.focus_score || 0), 0) / sessions.length) : 0;
        const topics = new Set(quizzes.map((q) => q.topic));

        // Last 7 days
        const last7Quizzes = quizzes.filter((q) => new Date(q.created_at) > new Date(Date.now() - 7 * 86400000));
        const last7Sessions = sessions.filter((s) => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000));
        const last7Minutes = last7Sessions.reduce((a, s) => a + s.duration_seconds / 60, 0);

        setStats([
          { label: "Study Hours", value: `${(totalMinutes / 60).toFixed(1)}h`, icon: Clock, change: `+${(last7Minutes / 60).toFixed(1)}h`, color: "text-primary" },
          { label: "Quizzes Taken", value: String(quizzes.length), icon: Zap, change: `+${last7Quizzes.length}`, color: "text-chart-2" },
          { label: "Focus Score", value: avgFocus ? `${avgFocus}%` : "—", icon: Target, change: sessions.length > 0 ? `${avgFocus}%` : "—", color: "text-chart-3" },
          { label: "Topics Covered", value: String(topics.size), icon: BookOpen, change: `+${topics.size}`, color: "text-chart-4" },
        ]);

        // Weekly chart
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const byDay: Record<string, { minutes: number; quizzes: number }> = {};
        days.forEach((d) => (byDay[d] = { minutes: 0, quizzes: 0 }));
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        last7Sessions.forEach((s) => { const d = dayNames[new Date(s.created_at).getDay()]; if (byDay[d]) byDay[d].minutes += Math.round(s.duration_seconds / 60); });
        last7Quizzes.forEach((q) => { const d = dayNames[new Date(q.created_at).getDay()]; if (byDay[d]) byDay[d].quizzes++; });
        setWeeklyData(days.map((d) => ({ day: d, minutes: byDay[d].minutes, quizzes: byDay[d].quizzes })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Your study overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-3xl font-bold mb-1">{s.value}</p>
            <span className="text-xs text-primary flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {s.change} this week
            </span>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 mb-8">
        <h3 className="font-semibold mb-4">Weekly Study Activity</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={weeklyData}>
            <defs>
              <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160,84%,44%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(160,84%,44%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
            <XAxis dataKey="day" stroke="hsl(215,12%,55%)" fontSize={12} />
            <YAxis stroke="hsl(215,12%,55%)" fontSize={12} />
            <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="minutes" stroke="hsl(160,84%,44%)" strokeWidth={2} fillOpacity={1} fill="url(#colorMinutes)" name="Minutes" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: "Summarize Notes", desc: "Paste any content and get an AI summary", icon: "📝" },
          { title: "Take a Quiz", desc: "Test your knowledge on any topic", icon: "⚡" },
          { title: "Study Flashcards", desc: "Review with AI-generated flashcards", icon: "🃏" },
        ].map((a) => (
          <div key={a.title} className="glass-card p-5 hover:border-primary/30 transition-colors cursor-pointer">
            <span className="text-2xl mb-3 block">{a.icon}</span>
            <h4 className="font-semibold mb-1">{a.title}</h4>
            <p className="text-sm text-muted-foreground">{a.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;
