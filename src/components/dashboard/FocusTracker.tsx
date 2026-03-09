import { useEffect, useRef, useCallback } from "react";
import { Target } from "lucide-react";

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

const FocusTracker = ({ state, onStateChange }: Props) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (state.isTracking) {
      intervalRef.current = setInterval(() => {
        onStateChange((p: FocusTrackerState) => ({
          ...p,
          totalTime: p.totalTime + 1,
        }));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isTracking]);

  return (
    <div>
      <h1 className="text-2xl font-bold flex gap-2 items-center">
        <Target /> Focus Tracker
      </h1>
      <p>Time: {state.totalTime}s</p>
    </div>
  );
};

export default FocusTracker;