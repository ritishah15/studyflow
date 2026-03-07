import { useState, useEffect } from "react";
import { FileText, Loader2, Copy, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SummaryRecord {
  id: string;
  input_text: string;
  summary_text: string;
  created_at: string;
}

const Summarizer = () => {
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SummaryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("summaries")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data);
  };

  const handleSummarize = async () => {
    if (!input.trim()) { toast({ title: "Enter some text", variant: "destructive" }); return; }
    setLoading(true);
    setSummary("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-study-tool", {
        body: { type: "summarize", content: input },
      });
      if (error) throw error;
      const result = data.result || "No summary generated.";
      setSummary(result);

      // Save to history
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("summaries").insert({
          user_id: session.user.id,
          input_text: input.substring(0, 5000),
          summary_text: result,
        });
        fetchHistory();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (record: SummaryRecord) => {
    setInput(record.input_text);
    setSummary(record.summary_text);
    setShowHistory(false);
  };

  const deleteRecord = async (id: string) => {
    await supabase.from("summaries").delete().eq("id", id);
    setHistory((prev) => prev.filter((r) => r.id !== id));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" /> AI Notes Summarizer
          </h1>
          <p className="text-muted-foreground">Paste your notes and get a structured summary instantly</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <Clock className="h-4 w-4 mr-1" /> History ({history.length})
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="glass-card p-4 mb-6 max-h-[300px] overflow-y-auto space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Recent Summaries</h3>
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer group"
              onClick={() => loadFromHistory(r)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.input_text.substring(0, 80)}...</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {new Date(r.created_at).toLocaleTimeString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-muted-foreground">Your Notes / Content</label>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your study notes, lecture content, or any text here..."
            className="min-h-[300px] bg-secondary border-border resize-none" />
          <Button onClick={handleSummarize} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Summarizing...</> : "Summarize with AI"}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">AI Summary</label>
            {summary && (
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <div className="glass-card p-6 min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Processing your notes...
              </div>
            ) : summary ? (
              <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap">{summary}</div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Your AI summary will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Summarizer;
