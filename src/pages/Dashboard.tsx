import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Brain, BookOpen, Zap, FileText, BarChart3, Target, LogOut, Shield, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import DashboardHome from "@/components/dashboard/DashboardHome";
import Summarizer from "@/components/dashboard/Summarizer";
import QuizGenerator from "@/components/dashboard/QuizGenerator";
import Flashcards from "@/components/dashboard/Flashcards";
import FocusTracker, { FocusTrackerState } from "@/components/dashboard/FocusTracker";
import StudyAnalytics from "@/components/dashboard/StudyAnalytics";
import Billing from "@/components/dashboard/Billing";

const DEFAULT_FOCUS_STATE: FocusTrackerState = {
  isTracking: false,
  totalTime: 0,
  focusedTime: 0,
  tabSwitches: 0,
  distractions: [],
  isVisible: true,
  history: [],
  showHistory: false,
  startTime: null,
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [focusState, setFocusState] = useState(DEFAULT_FOCUS_STATE);

  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      setUser(session.user);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (roles?.some((r: any) => r.role === "admin")) {
        setIsAdmin(true);
      }
    };

    checkAuth();
  }, [navigate]);

  const renderContent = () => {
    switch (activeTab) {
      case "summarizer":
        return <Summarizer />;
      case "quiz":
        return <QuizGenerator />;
      case "flashcards":
        return <Flashcards />;
      case "focus":
        return <FocusTracker state={focusState} onStateChange={setFocusState} />;
      case "analytics":
        return <StudyAnalytics />;
      case "billing":
        return <Billing />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="flex">
      <aside className="w-64 p-4 border-r">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <Brain className="h-6 w-6" />
          <span className="font-bold">StudyFlow AI</span>
        </Link>

        <button onClick={() => setActiveTab("home")}>Dashboard</button>
        <button onClick={() => setActiveTab("summarizer")}>Summarizer</button>
        <button onClick={() => setActiveTab("quiz")}>Quiz</button>
        <button onClick={() => setActiveTab("flashcards")}>Flashcards</button>
        <button onClick={() => setActiveTab("focus")}>Focus</button>

        {isAdmin && (
          <button onClick={() => navigate("/admin")}>
            <Shield className="h-4 w-4" /> Admin
          </button>
        )}
      </aside>

      <main className="flex-1 p-8">{renderContent()}</main>
    </div>
  );
};

export default Dashboard;