import { useEffect } from "react";
import { Target, AlertTriangle, Eye, EyeOff, Pause, RotateCcw, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { FocusTrackerState, SessionRecord } from "@/pages/Dashboard";

interface FocusTrackerProps {
  state: FocusTrackerState;
  onStateChange: (updater: (prev: FocusTrackerState) => FocusTrackerState) => void;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}

const DEFAULT_RESET: Omit<FocusTrackerState, "history" | "showHistory"> = {
  isTracking: false,
  totalTime: 0,
  focusedTime: 0,
  tabSwitches: 0,
  distractions: [],
  isVisible: true,
  startTime: null,
};

const FocusTracker = ({ state, onStateChange, toast }: FocusTrackerProps) => {
  const set = (updater: (prev: FocusTrackerState) => FocusTrackerState) => onStateChange(updater);

  const focusScore = state.totalTime > 0
    ? Math.round((state.focusedTime / state.totalTime) * 100)
    : null;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) set((p) => ({ ...p, history: data as SessionRecord[] }));
  };

  const saveSession = async () => {
    if (state.totalTime < 10) {
      toast({ title: "Session too short to save", variant: "destructive" });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const score = focusScore ?? 0;
      await supabase.from("study_sessions").insert({
        user_id: session.user.id,
        started_at: state.startTime || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: state.totalTime,
        focus_score: score,
        tab_switches: state.tabSwitches,
      });
      toast({ title: "Session saved!", description: `${formatTime(state.totalTime)} with ${score}% focus` });
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    }
  };

  const stopAndSave = async () => {
    set((p) => ({ ...p, isTracking: false }));
    await saveSession();
  };

  const reset = () => {
    set((p) => ({
      ...DEFAULT_RESET,
      history: p.history,
      showHistory: p.showHistory,
    }));
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const scoreColor =
    focusScore === null
      ? "text-muted-foreground"
      : focusScore >= 80
      ? "text-primary"
      : focusScore >= 50
      ? "text-chart-3"
      : "text-destructive";

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <Target className="h-8 w-8 text-chart-3" /> Focus Tracker
          </h1>
          <p className="text-muted-foreground">Track your focus and detect distractions in real-time</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => set((p) => ({ ...p, showHistory: !p.showHistory }))}>
          <Clock className="h-4 w-4 mr-1" /> History ({state.history.length})
        </Button>
      </div>

      {state.isTracking && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse inline-block" />
          Session active — switching dashboard tabs will not pause your timer
        </div>
      )}

      {state.showHistory && state.history.length > 0 && (
        <div className="glass-card p-4 mb-6 max-h-[300px] overflow-y-auto space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Session History</h3>
          {state.history.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-medium">{formatTime(r.duration_seconds)} session</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()} · {r.tab_switches} tab switches
                </p>
              </div>
              <span className={`text-sm font-bold ${(r.focus_score || 0) >= 70 ? "text-primary" : "text-destructive"}`}>
                {r.focus_score}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-8 text-center">
          <div className="text-6xl font-mono font-bold mb-2 gradient-text">{formatTime(state.totalTime)}</div>
          <p className="text-muted-foreground mb-6">Total Study Time</p>

          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Focus Score</span>
              <span className={`font-bold ${scoreColor}`}>
                {focusScore === null ? "—" : `${focusScore}%`}
              </span>
            </div>
            <Progress value={focusScore ?? 0} className="h-3" />
          </div>

          <div className="flex justify-center gap-3">
            {state.isTracking ? (
              <Button onClick={stopAndSave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Pause className="h-4 w-4 mr-1" /> Stop & Save
              </Button>
            ) : (
              <Button
                onClick={() =>
                  set((p) => ({
                    ...p,
                    isTracking: true,
                    startTime: p.startTime || new Date().toISOString(),
                  }))
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Play className="h-4 w-4 mr-1" /> Start
              </Button>
            )}
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div>
              <p className="text-2xl font-bold text-primary">{formatTime(state.focusedTime)}</p>
              <p className="text-xs text-muted-foreground">Focused</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-chart-3">{formatTime(state.totalTime - state.focusedTime)}</p>
              <p className="text-xs text-muted-foreground">Distracted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{state.tabSwitches}</p>
              <p className="text-xs text-muted-foreground">Tab Switches</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`glass-card p-4 flex items-center gap-3 border ${state.isVisible ? "border-primary/30" : "border-destructive/30"}`}>
            {state.isVisible ? (
              <>
                <Eye className="h-5 w-5 text-primary" />
                <span className="text-primary font-medium">You're focused! Keep going!</span>
              </>
            ) : (
              <>
                <EyeOff className="h-5 w-5 text-destructive" />
                <span className="text-destructive font-medium">Tab switched — you're distracted!</span>
              </>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-chart-3" /> Distraction Log
            </h3>
            {state.distractions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No distractions detected yet. Start tracking!
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {state.distractions.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 text-sm">
                    <span className="text-muted-foreground">{d.time}</span>
                    <span className="text-destructive font-medium">{d.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusTracker;