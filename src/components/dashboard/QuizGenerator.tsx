import { useState, useEffect } from "react";
import { Zap, Loader2, CheckCircle2, XCircle, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Question { question: string; options: string[]; correct: number; }
interface QuizRecord { id: string; topic: string; score: number; total_questions: number; created_at: string; }

const QuizGenerator = () => {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<QuizRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data);
  };

  const generateQuiz = async () => {
    if (!topic.trim()) { toast({ title: "Enter a topic", variant: "destructive" }); return; }
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-study-tool", {
        body: { type: "quiz", content: topic },
      });
      if (error) throw error;
      setQuestions(data.result || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const submitQuiz = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast({ title: "Answer all questions first", variant: "destructive" }); return;
    }
    setSubmitted(true);
    const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    toast({ title: `Score: ${score}/${questions.length}`, description: score === questions.length ? "Perfect! 🎉" : "Keep studying!" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("quiz_results").insert({
          user_id: session.user.id, topic, score, total_questions: questions.length,
        });
        fetchHistory();
      }
    } catch (err) { console.error("Failed to save quiz result:", err); }
  };

  const score = submitted ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0) : 0;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <Zap className="h-8 w-8 text-chart-3" /> Smart Quiz Generator
          </h1>
          <p className="text-muted-foreground">Enter any topic and AI generates a quiz instantly</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <Clock className="h-4 w-4 mr-1" /> History ({history.length})
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="glass-card p-4 mb-6 max-h-[300px] overflow-y-auto space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Quiz History</h3>
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-medium">{r.topic}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-sm font-bold ${(r.score / r.total_questions) >= 0.7 ? "text-primary" : "text-destructive"}`}>
                {r.score}/{r.total_questions}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-8">
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Photosynthesis, World War II, React Hooks..."
          className="bg-secondary border-border" onKeyDown={(e) => e.key === "Enter" && generateQuiz()} />
        <Button onClick={generateQuiz} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Quiz"}
        </Button>
      </div>

      {questions.length > 0 && (
        <div className="space-y-6">
          {submitted && (
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">Score: <span className="gradient-text">{score}/{questions.length}</span></p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSubmitted(false); setAnswers({}); }}>
                <RotateCcw className="h-4 w-4 mr-1" /> Retry
              </Button>
            </div>
          )}
          {questions.map((q, qi) => (
            <div key={qi} className="glass-card p-6">
              <p className="font-medium mb-4"><span className="text-primary mr-2">Q{qi + 1}.</span>{q.question}</p>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[qi] === oi;
                  const isCorrect = submitted && oi === q.correct;
                  const isWrong = submitted && isSelected && oi !== q.correct;
                  return (
                    <button key={oi} onClick={() => selectAnswer(qi, oi)}
                      className={`text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                        isCorrect ? "border-primary bg-primary/10 text-primary" :
                        isWrong ? "border-destructive bg-destructive/10 text-destructive" :
                        isSelected ? "border-primary/50 bg-primary/5" :
                        "border-border hover:border-muted-foreground/30 hover:bg-secondary"
                      }`}>
                      <span className="flex items-center gap-2">
                        {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        {isWrong && <XCircle className="h-4 w-4 shrink-0" />}
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!submitted && (
            <Button onClick={submitQuiz} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Submit Answers</Button>
          )}
        </div>
      )}

      {!loading && questions.length === 0 && (
        <div className="glass-card p-12 text-center text-muted-foreground">Enter a topic above and the AI will generate a quiz for you</div>
      )}
    </div>
  );
};

export default QuizGenerator;
