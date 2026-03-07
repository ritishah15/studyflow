import { useState, useEffect } from "react";
import { BookOpen, Loader2, ChevronLeft, ChevronRight, RotateCcw, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Flashcard { front: string; back: string; }
interface FlashcardSet { id: string; topic: string; cards: Flashcard[]; card_count: number; created_at: string; }

const Flashcards = () => {
  const [topic, setTopic] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState<FlashcardSet[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("flashcard_sets")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data.map((d: any) => ({ ...d, cards: d.cards as Flashcard[] })));
  };

  const generateCards = async () => {
    if (!topic.trim()) { toast({ title: "Enter a topic", variant: "destructive" }); return; }
    setLoading(true); setCards([]); setCurrentIndex(0); setFlipped(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-study-tool", {
        body: { type: "flashcards", content: topic },
      });
      if (error) throw error;
      const result = data.result || [];
      setCards(result);

      // Save to history
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("flashcard_sets").insert({
          user_id: session.user.id,
          topic,
          cards: result as any,
          card_count: result.length,
        });
        fetchHistory();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const loadFromHistory = (set: FlashcardSet) => {
    setCards(set.cards);
    setTopic(set.topic);
    setCurrentIndex(0);
    setFlipped(false);
    setShowHistory(false);
  };

  const deleteRecord = async (id: string) => {
    await supabase.from("flashcard_sets").delete().eq("id", id);
    setHistory((prev) => prev.filter((r) => r.id !== id));
  };

  const next = () => { setFlipped(false); setCurrentIndex((i) => Math.min(i + 1, cards.length - 1)); };
  const prev = () => { setFlipped(false); setCurrentIndex((i) => Math.max(i - 1, 0)); };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-chart-2" /> AI Flashcards
          </h1>
          <p className="text-muted-foreground">Generate flashcards from any topic for effective revision</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <Clock className="h-4 w-4 mr-1" /> History ({history.length})
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="glass-card p-4 mb-6 max-h-[300px] overflow-y-auto space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Previous Flashcard Sets</h3>
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer group"
              onClick={() => loadFromHistory(r)}>
              <div>
                <p className="text-sm font-medium">{r.topic}</p>
                <p className="text-xs text-muted-foreground">{r.card_count} cards · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-8">
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Cell Biology, Calculus, JavaScript..."
          className="bg-secondary border-border" onKeyDown={(e) => e.key === "Enter" && generateCards()} />
        <Button onClick={generateCards} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Cards"}
        </Button>
      </div>

      {cards.length > 0 && (
        <div className="max-w-xl mx-auto">
          <div className="text-center text-sm text-muted-foreground mb-4">Card {currentIndex + 1} of {cards.length} — Click to flip</div>
          <div className="glass-card min-h-[250px] flex items-center justify-center p-8 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setFlipped(!flipped)}>
            <AnimatePresence mode="wait">
              <motion.div key={`${currentIndex}-${flipped}`}
                initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: -90 }} transition={{ duration: 0.3 }} className="text-center">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">{flipped ? "Answer" : "Question"}</span>
                <p className={`text-xl font-medium ${flipped ? "text-primary" : ""}`}>
                  {flipped ? cards[currentIndex].back : cards[currentIndex].front}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button variant="outline" size="sm" onClick={prev} disabled={currentIndex === 0}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => { setCurrentIndex(0); setFlipped(false); }}><RotateCcw className="h-4 w-4 mr-1" /> Reset</Button>
            <Button variant="outline" size="sm" onClick={next} disabled={currentIndex === cards.length - 1}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {!loading && cards.length === 0 && (
        <div className="glass-card p-12 text-center text-muted-foreground">Enter a topic to generate flashcards</div>
      )}
    </div>
  );
};

export default Flashcards;
