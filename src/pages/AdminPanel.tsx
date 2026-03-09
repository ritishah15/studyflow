import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, BarChart3, Shield, ArrowLeft, Eye, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(160,84%,44%)",
  "hsl(200,80%,55%)",
  "hsl(38,92%,55%)",
  "hsl(280,70%,60%)",
  "hsl(0,72%,55%)",
];

const AdminPanel = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<Record<string, any>>({});
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

      if (!session) {
        navigate("/admin-login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (!roles?.some((r: any) => r.role === "admin")) {
        toast({ title: "Access denied", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      const [profilesRes, quizzesRes, sessionsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("quiz_results").select("*"),
        supabase.from("study_sessions").select("*"),
      ]);

      const profiles = profilesRes.data || [];
      const quizzes = quizzesRes.data || [];
      const sessions = sessionsRes.data || [];

      setStudents(profiles);

      const perStudent: Record<string, any> = {};

      profiles.forEach((p: any) => {
        const uq = quizzes.filter((q: any) => q.user_id === p.user_id);
        const us = sessions.filter((s: any) => s.user_id === p.user_id);

        perStudent[p.user_id] = {
          quizzes: uq.length,
          avgScore:
            uq.length > 0
              ? Math.round(
                  uq.reduce(
                    (a: number, q: any) => a + (q.score / q.total_questions) * 100,
                    0
                  ) / uq.length
                )
              : 0,
          sessions: us.length,
          avgFocus:
            us.length > 0
              ? Math.round(
                  us.reduce((a: number, s: any) => a + (s.focus_score || 0), 0) /
                    us.length
                )
              : 0,
        };
      });

      setStudentStats(perStudent);

      const activeToday = profiles.filter(
        (p: any) =>
          p.last_active &&
          new Date(p.last_active) > new Date(Date.now() - 86400000)
      ).length;

      const allFocus =
        sessions.length > 0
          ? Math.round(
              sessions.reduce((a: number, s: any) => a + (s.focus_score || 0), 0) /
                sessions.length
            )
          : 0;

      setStats({
        total: profiles.length,
        active: activeToday,
        avgFocus: allFocus,
        totalQuizzes: quizzes.length,
      });

      setLoading(false);
    };

    loadAdmin();
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <div className="min-h-screen p-8">Admin Dashboard Loaded</div>;
};

export default AdminPanel;