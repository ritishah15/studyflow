import { useState, useEffect, useRef, useCallback } from "react";
import { Target, AlertTriangle, Eye, EyeOff, Play, Pause, RotateCcw, Clock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SessionRecord { id: string; duration_seconds: number; focus_score: number; tab_switches: number; created_at: string; }

const FocusTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [totalTime, setTotalTime] = useState(0);
  const [focusedTime, setFocusedTime] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [distractions, setDistractions] = useState<{ time: string; type: string }[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<string | null>(null);
  const { toast } = useToast();

  const focusScore = totalTime > 0 ? Math.round((focusedTime / totalTime) * 100) : 100;

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data as SessionRecord[]);
  };

  const handleVisibilityChange = useCallback(() => {
    if (!isTracking) return;
    const visible = !document.hidden;
    setIsVisible(visible);
    if (!visible) {
      setTabSwitches((p) => p + 1);
      setDistractions((p) => [{ time: new Date().toLocaleTimeString(), type: "Tab switched" }, ...p]);
    }
  }, [isTracking]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleVisibilityChange]);

  useEffect(() => {
    if (isTracking) {
      if (!startTimeRef.current) startTimeRef.current = new Date().toISOString();
      intervalRef.current = setInterval(() => {
        setTotalTime((p) => p + 1);
        if (!document.hidden) setFocusedTime((p) => p + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isTracking]);

  const saveSession = async () => {
    if (totalTime < 10) { toast({ title: "Session too short to save", variant: "destructive" }); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("study_sessions").insert({
        user_id: session.user.id,
        started_at: startTimeRef.current || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: totalTime,
        focus_score: focusScore,
        tab_switches: tabSwitches,
      });
      toast({ title: "Session saved!", description: `${formatTime(totalTime)} with ${focusScore}% focus` });
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    }
  };

  const stopAndSave = async () => {
    setIsTracking(false);
    await saveSession();
  };

  const reset = () => {
    setIsTracking(false); setTotalTime(0); setFocusedTime(0);
    setTabSwitches(0); setDistractions([]); startTimeRef.current = null;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <Target className="h-8 w-8 text-chart-3" /> Focus Tracker
          </h1>
          <p className="text-muted-foreground">Track your focus and detect distractions in real-time</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <Clock className="h-4 w-4 mr-1" /> History ({history.length})
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="glass-card p-4 mb-6 max-h-[300px] overflow-y-auto space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Session History</h3>
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-medium">{formatTime(r.duration_seconds)} session</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.tab_switches} tab switches</p>
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
          <div className="text-6xl font-mono font-bold mb-2 gradient-text">{formatTime(totalTime)}</div>
          <p className="text-muted-foreground mb-6">Total Study Time</p>
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Focus Score</span>
              <span className={`font-bold ${focusScore >= 80 ? "text-primary" : focusScore >= 50 ? "text-chart-3" : "text-destructive"}`}>{focusScore}%</span>
            </div>
            <Progress value={focusScore} className="h-3" />
          </div>
          <div className="flex justify-center gap-3">
            {isTracking ? (
              <Button onClick={stopAndSave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Pause className="h-4 w-4 mr-1" /> Stop & Save
              </Button>
            ) : (
              <Button onClick={() => setIsTracking(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Play className="h-4 w-4 mr-1" /> Start
              </Button>
            )}
            <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4 mr-1" /> Reset</Button>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div><p className="text-2xl font-bold text-primary">{formatTime(focusedTime)}</p><p className="text-xs text-muted-foreground">Focused</p></div>
            <div><p className="text-2xl font-bold text-chart-3">{formatTime(totalTime - focusedTime)}</p><p className="text-xs text-muted-foreground">Distracted</p></div>
            <div><p className="text-2xl font-bold text-destructive">{tabSwitches}</p><p className="text-xs text-muted-foreground">Tab Switches</p></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`glass-card p-4 flex items-center gap-3 ${isVisible ? "border-primary/30" : "border-destructive/30"}`}>
            {isVisible ? (
              <><Eye className="h-5 w-5 text-primary" /><span className="text-primary font-medium">You're focused! Keep going!</span></>
            ) : (
              <><EyeOff className="h-5 w-5 text-destructive" /><span className="text-destructive font-medium">Tab switched — You're distracted!</span></>
            )}
          </div>
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-chart-3" /> Distraction Log</h3>
            {distractions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No distractions detected yet. Start tracking!</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {distractions.map((d, i) => (
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
