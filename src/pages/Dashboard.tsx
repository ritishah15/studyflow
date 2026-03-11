import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Brain, BookOpen, Zap, FileText, BarChart3, Target, LogOut, Shield, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DashboardHome from "@/components/dashboard/DashboardHome";
import Summarizer from "@/components/dashboard/Summarizer";
import QuizGenerator from "@/components/dashboard/QuizGenerator";
import Flashcards from "@/components/dashboard/Flashcards";
import FocusTracker from "@/components/dashboard/FocusTracker";
import StudyAnalytics from "@/components/dashboard/StudyAnalytics";
import Billing from "@/components/dashboard/Billing";

export interface FocusTrackerState {
  isTracking: boolean;
  totalTime: number;
  focusedTime: number;
  tabSwitches: number;
  distractions: { time: string; type: string }[];
  isVisible: boolean;
  history: SessionRecord[];
  showHistory: boolean;
  startTime: string | null;
}

export interface SessionRecord {
  id: string;
  duration_seconds: number;
  focus_score: number;
  tab_switches: number;
  created_at: string;
}

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

const navItems = [
  { id: "home", label: "Dashboard", icon: BarChart3 },
  { id: "summarizer", label: "Summarizer", icon: FileText },
  { id: "quiz", label: "Quiz Generator", icon: Zap },
  { id: "flashcards", label: "Flashcards", icon: BookOpen },
  { id: "focus", label: "Focus Tracker", icon: Target },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const Dashboard = () => {
  // Restore last active tab from sessionStorage so refresh keeps you on same tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem("activeTab") || "home";
  });
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [focusState, setFocusState] = useState<FocusTrackerState>(DEFAULT_FOCUS_STATE);

  // isPageVisible tracks REAL browser tab switches only (not internal navigation)
  const isPageVisibleRef = useRef<boolean>(!document.hidden);

  // intervalRef lives in Dashboard so timer NEVER stops on internal tab switch
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTrackingRef = useRef<boolean>(false);
  isTrackingRef.current = focusState.isTracking;

  const navigate = useNavigate();
  const { toast } = useToast();

  // Persist active tab to sessionStorage whenever it changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    sessionStorage.setItem("activeTab", tabId);
  };

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUser(session.user);
      await supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("user_id", session.user.id);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (roles?.some((r: any) => r.role === "admin")) setIsAdmin(true);
    };
    checkAuth();
  }, [navigate]);

  // Visibility listener - fires ONLY on real browser tab/window switch, never on internal nav
  const handleVisibilityChange = useCallback(() => {
    if (!isTrackingRef.current) return;
    const visible = !document.hidden;
    isPageVisibleRef.current = visible;
    setFocusState((p) => ({ ...p, isVisible: visible }));
    if (!visible) {
      setFocusState((p) => ({
        ...p,
        tabSwitches: p.tabSwitches + 1,
        distractions: [
          { time: new Date().toLocaleTimeString(), type: "Tab switched" },
          ...p.distractions,
        ],
      }));
    }
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleVisibilityChange]);

  // Timer lives in Dashboard — survives all internal tab switches
  // Uses isPageVisibleRef (not document.hidden) to correctly count focused time
  useEffect(() => {
    if (focusState.isTracking) {
      // Clear any existing interval first to avoid doubles
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        setFocusState((p) => ({
          ...p,
          totalTime: p.totalTime + 1,
          // Only count as focused if browser tab is actually visible
          focusedTime: isPageVisibleRef.current ? p.focusedTime + 1 : p.focusedTime,
        }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [focusState.isTracking]);

  const handleLogout = async () => {
    sessionStorage.removeItem("activeTab");
    await supabase.auth.signOut();
    navigate("/");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "summarizer": return <Summarizer />;
      case "quiz": return <QuizGenerator />;
      case "flashcards": return <Flashcards />;
      case "focus": return (
        <FocusTracker
          state={focusState}
          onStateChange={setFocusState}
          toast={toast}
        />
      );
      case "analytics": return <StudyAnalytics />;
      case "billing": return <Billing />;
      default: return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-sm flex flex-col fixed h-full">
        <div className="p-4 border-b border-border/50">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold gradient-text">StudyFlow AI</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.id === "focus" && focusState.isTracking && (
                <span className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
            >
              <Shield className="h-4 w-4" /> Admin Panel
            </button>
          )}
        </nav>
        <div className="p-3 border-t border-border/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.user_metadata?.full_name || "Student"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8">{renderContent()}</main>
    </div>
  );
};

export default Dashboard;
