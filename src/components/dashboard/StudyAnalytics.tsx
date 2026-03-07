import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["hsl(160,84%,44%)", "hsl(200,80%,55%)", "hsl(38,92%,55%)", "hsl(280,70%,60%)", "hsl(0,72%,55%)"];

const StudyAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any[]>([]);
  const [topicBreakdown, setTopicBreakdown] = useState<any[]>([]);
  const [skillData, setSkillData] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, totalStudyHours: 0, avgFocus: 0 });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const [quizRes, sessionRes] = await Promise.all([
        supabase.from("quiz_results").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
        supabase.from("study_sessions").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      ]);

      const quizzes = quizRes.data || [];
      const sessions = sessionRes.data || [];

      // Quiz score trend (last 10)
      const recentQuizzes = quizzes.slice(-10).map((q, i) => ({
        label: q.topic?.substring(0, 8) || `Q${i + 1}`,
        score: Math.round((q.score / q.total_questions) * 100),
      }));
      setQuizData(recentQuizzes);

      // Study sessions over time (group by day, last 7 days)
      const last7 = sessions.filter(s => {
        const d = new Date(s.created_at);
        return d > new Date(Date.now() - 7 * 86400000);
      });
      const byDay: Record<string, { minutes: number; focus: number; count: number }> = {};
      last7.forEach(s => {
        const day = new Date(s.created_at).toLocaleDateString("en-US", { weekday: "short" });
        if (!byDay[day]) byDay[day] = { minutes: 0, focus: 0, count: 0 };
        byDay[day].minutes += Math.round(s.duration_seconds / 60);
        byDay[day].focus += (s.focus_score || 0);
        byDay[day].count += 1;
      });
      setSessionData(Object.entries(byDay).map(([day, v]) => ({
        day,
        minutes: v.minutes,
        focus: v.count > 0 ? Math.round(v.focus / v.count) : 0,
      })));

      // Topic breakdown from quizzes
      const topicMap: Record<string, number> = {};
      quizzes.forEach(q => {
        const t = q.topic || "Other";
        topicMap[t] = (topicMap[t] || 0) + 1;
      });
      setTopicBreakdown(Object.entries(topicMap).slice(0, 5).map(([subject, value]) => ({ subject, value })));

      // Skill radar from real data
      const totalQuizzes = quizzes.length;
      const avgScore = totalQuizzes > 0 ? Math.round(quizzes.reduce((a, q) => a + (q.score / q.total_questions) * 100, 0) / totalQuizzes) : 0;
      const totalMinutes = sessions.reduce((a, s) => a + s.duration_seconds / 60, 0);
      const avgFocus = sessions.length > 0 ? Math.round(sessions.reduce((a, s) => a + (s.focus_score || 0), 0) / sessions.length) : 0;
      const avgTabs = sessions.length > 0 ? Math.round(sessions.reduce((a, s) => a + (s.tab_switches || 0), 0) / sessions.length) : 0;
      const consistency = Math.min(100, totalQuizzes * 10 + sessions.length * 5);

      setSkillData([
        { skill: "Focus", A: avgFocus || 50 },
        { skill: "Accuracy", A: avgScore || 50 },
        { skill: "Consistency", A: Math.min(consistency, 100) },
        { skill: "Discipline", A: Math.max(0, 100 - avgTabs * 5) },
        { skill: "Volume", A: Math.min(100, Math.round(totalMinutes / 2)) },
      ]);

      setStats({
        totalQuizzes,
        avgScore,
        totalStudyHours: Math.round(totalMinutes / 60 * 10) / 10,
        avgFocus,
      });
    } catch (err) {
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-chart-4" /> Study Analytics
        </h1>
        <p className="text-muted-foreground">Track your growth and identify areas for improvement</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Quizzes Taken", value: stats.totalQuizzes },
          { label: "Avg Score", value: `${stats.avgScore}%` },
          { label: "Study Hours", value: stats.totalStudyHours },
          { label: "Avg Focus", value: `${stats.avgFocus}%` },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className="text-2xl font-bold gradient-text">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Study Sessions */}
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Study Time (Last 7 Days)
          </h3>
          {sessionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={sessionData}>
                <defs>
                  <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160,84%,44%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160,84%,44%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                <XAxis dataKey="day" stroke="hsl(215,12%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,12%,55%)" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="minutes" stroke="hsl(160,84%,44%)" fillOpacity={1} fill="url(#colorMin)" strokeWidth={2} name="Minutes" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              Start a focus session to see data here
            </div>
          )}
        </div>

        {/* Topic Breakdown */}
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Quiz Topic Distribution</h3>
          {topicBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={topicBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                  label={({ subject, value }) => `${subject} (${value})`}>
                  {topicBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              Take quizzes to see topic breakdown
            </div>
          )}
        </div>

        {/* Quiz Scores */}
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Quiz Score Trend</h3>
          {quizData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={quizData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,18%)" />
                <XAxis dataKey="label" stroke="hsl(215,12%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,12%,55%)" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,14%,18%)", borderRadius: 8 }} />
                <Bar dataKey="score" fill="hsl(200,80%,55%)" radius={[4,4,0,0]} name="Score %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              Complete quizzes to see score trends
            </div>
          )}
        </div>

        {/* Skill Radar */}
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Skill Assessment</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={skillData}>
              <PolarGrid stroke="hsl(220,14%,18%)" />
              <PolarAngleAxis dataKey="skill" stroke="hsl(215,12%,55%)" fontSize={11} />
              <Radar dataKey="A" stroke="hsl(160,84%,44%)" fill="hsl(160,84%,44%)" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StudyAnalytics;
