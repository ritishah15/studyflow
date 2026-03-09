import { useEffect, useRef, useCallback } from "react";
import { Target, Play, Square, Eye, EyeOff, History, Zap, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface FocusTrackerState {
  isTracking: boolean;
  totalTime: number;
  focusedTime: number;
  tabSwitches: number;
  distractions: { time: string; type: string }[];
  isVisible: boolean;
  history: any[];
  showHistory: boolean;
  startTime: string | null;
}

interface Props {
  state: FocusTrackerState;
  onStateChange: any;
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getFocusScore = (focusedTime: number, totalTime: number) => {
  if (totalTime === 0) return 0;
  return Math.round((focusedTime / totalTime) * 100);
};

const FocusTracker = ({ state, onStateChange }: Props) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer tick
  useEffect(() => {
    if (state.isTracking) {
      intervalRef.current = setInterval(() => {
        onStateChange((p: FocusTrackerState) => ({
          ...p,
          totalTime: p.totalTime + 1,
          focusedTime: p.isVisible ? p.focusedTime + 1 : p.focusedTime,
        }));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isTracking, state.isVisible]);

  // Visibility / tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      onStateChange((p: FocusTrackerState) => {
        const newDistractions = visible
          ? p.distractions
          : [
              ...p.distractions,
              { time: new Date().toLocaleTimeString(), type: "Tab switch" },
            ];
        return {
          ...p,
          isVisible: visible,
          tabSwitches: visible ? p.tabSwitches : p.tabSwitches + 1,
          distractions: newDistractions,
        };
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleStart = () => {
    onStateChange((p: FocusTrackerState) => ({
      ...p,
      isTracking: true,
      startTime: new Date().toISOString(),
      totalTime: 0,
      focusedTime: 0,
      tabSwitches: 0,
      distractions: [],
    }));
  };

  const handleStop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const score = getFocusScore(state.focusedTime, state.totalTime);

    // Save to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("study_sessions").insert({
          user_id: session.user.id,
          duration_seconds: state.totalTime,
          focus_score: score,
          tab_switches: state.tabSwitches,
          created_at: state.startTime || new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Failed to save session:", e);
    }

    onStateChange((p: FocusTrackerState) => ({
      ...p,
      isTracking: false,
      history: [
        {
          date: new Date().toLocaleDateString(),
          duration: p.totalTime,
          focusScore: score,
          tabSwitches: p.tabSwitches,
        },
        ...p.history,
      ],
    }));
  };

  const score = getFocusScore(state.focusedTime, state.totalTime);
  const scoreColor =
    score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          Focus Tracker
        </h1>
        <p className="text-muted-foreground">
          Stay focused and track your study sessions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Main Timer Card */}
        <div
          className="lg:col-span-2 glass-card p-8"
          style={{ borderRadius: "16px" }}
        >
          <div className="flex flex-col items-center justify-center" style={{ gap: "32px" }}>

            {/* Circular Timer */}
            <div style={{ position: "relative", width: "220px", height: "220px" }}>
              <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="110" cy="110" r="96" fill="none" stroke="hsl(220,14%,18%)" strokeWidth="12" />
                <circle
                  cx="110" cy="110" r="96"
                  fill="none"
                  stroke={state.isTracking ? (state.isVisible ? "#10b981" : "#ef4444") : "hsl(var(--primary))"}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 96}`}
                  strokeDashoffset={`${2 * Math.PI * 96 * (1 - Math.min(state.totalTime / 3600, 1))}`}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "42px", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-2px" }}>
                  {formatTime(state.totalTime)}
                </span>
                <span style={{ fontSize: "13px", color: "hsl(215,12%,55%)" }}>
                  {state.isTracking
                    ? state.isVisible ? "● Focused" : "⚠ Distracted"
                    : "Ready"}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: "16px" }}>
              {!state.isTracking ? (
                <button
                  onClick={handleStart}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 32px",
                    borderRadius: "50px",
                    background: "hsl(var(--primary))",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: "16px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 24px hsl(var(--primary) / 0.4)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <Play style={{ width: "18px", height: "18px" }} />
                  Start Session
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 32px",
                    borderRadius: "50px",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "16px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 24px rgba(239,68,68,0.4)",
                    transition: "transform 0.15s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <Square style={{ width: "18px", height: "18px" }} />
                  Stop Session
                </button>
              )}
            </div>

            {/* Status bar */}
            {state.isTracking && (
              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  padding: "12px 24px",
                  borderRadius: "50px",
                  background: "hsl(220,14%,12%)",
                  fontSize: "13px",
                  color: "hsl(215,12%,55%)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {state.isVisible
                    ? <Eye style={{ width: "14px", height: "14px", color: "#10b981" }} />
                    : <EyeOff style={{ width: "14px", height: "14px", color: "#ef4444" }} />}
                  {state.isVisible ? "On page" : "Away"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle style={{ width: "14px", height: "14px", color: "#f59e0b" }} />
                  {state.tabSwitches} switches
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock style={{ width: "14px", height: "14px", color: "#10b981" }} />
                  {formatTime(state.focusedTime)} focused
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Focus Score */}
          <div className="glass-card p-5" style={{ borderRadius: "16px" }}>
            <p style={{ fontSize: "13px", color: "hsl(215,12%,55%)", marginBottom: "8px" }}>Focus Score</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "48px", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
                {state.totalTime > 0 ? score : "—"}
              </span>
              {state.totalTime > 0 && <span style={{ fontSize: "20px", color: scoreColor, marginBottom: "6px" }}>%</span>}
            </div>
            {state.totalTime > 0 && (
              <div style={{ background: "hsl(220,14%,18%)", borderRadius: "50px", height: "6px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${score}%`,
                    height: "100%",
                    background: scoreColor,
                    borderRadius: "50px",
                    transition: "width 1s ease",
                  }}
                />
              </div>
            )}
            <p style={{ fontSize: "12px", color: "hsl(215,12%,55%)", marginTop: "8px" }}>
              {score >= 80 ? "🎯 Excellent focus!" : score >= 50 ? "👍 Good effort" : score > 0 ? "💪 Keep going!" : "Start a session to track"}
            </p>
          </div>

          {/* Quick Stats */}
          {[
            { label: "Total Time", value: formatTime(state.totalTime), icon: Clock, color: "#10b981" },
            { label: "Focused Time", value: formatTime(state.focusedTime), icon: CheckCircle, color: "#3b82f6" },
            { label: "Tab Switches", value: String(state.tabSwitches), icon: AlertTriangle, color: "#f59e0b" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4" style={{ borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "12px", color: "hsl(215,12%,55%)", marginBottom: "4px" }}>{stat.label}</p>
                  <p style={{ fontSize: "22px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stat.value}</p>
                </div>
                <stat.icon style={{ width: "20px", height: "20px", color: stat.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distractions Log */}
      {state.distractions.length > 0 && (
        <div className="glass-card p-6 mb-6" style={{ borderRadius: "16px" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle style={{ width: "16px", height: "16px", color: "#f59e0b" }} />
            Distraction Log
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
            {state.distractions.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "hsl(220,14%,12%)",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "#f59e0b" }}>⚠</span>
                <span style={{ color: "hsl(215,12%,55%)" }}>{d.time}</span>
                <span>{d.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      {state.history.length > 0 && (
        <div className="glass-card p-6" style={{ borderRadius: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <History style={{ width: "16px", height: "16px" }} />
              Session History
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {state.history.slice(0, 5).map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: "hsl(220,14%,12%)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Zap style={{ width: "14px", height: "14px", color: "#10b981" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500 }}>{h.date}</p>
                    <p style={{ fontSize: "12px", color: "hsl(215,12%,55%)" }}>{formatTime(h.duration)} total</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: h.focusScore >= 80 ? "#10b981" : h.focusScore >= 50 ? "#f59e0b" : "#ef4444"
                  }}>
                    {h.focusScore}%
                  </p>
                  <p style={{ fontSize: "11px", color: "hsl(215,12%,55%)" }}>{h.tabSwitches} switches</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusTracker;
