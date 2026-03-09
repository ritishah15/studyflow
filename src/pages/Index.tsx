import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Brain, Zap, Shield, BarChart3, BookOpen, Target, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  { icon: Brain, title: "AI Notes Summarizer", desc: "Paste your notes, get instant structured summaries with key concepts highlighted." },
  { icon: Zap, title: "Smart Quiz Generator", desc: "AI generates quizzes from any topic. Track scores and improve over time." },
  { icon: BookOpen, title: "Flashcard Engine", desc: "Auto-generate flashcards from topics. Spaced repetition built-in." },
  { icon: Target, title: "Focus Tracker", desc: "Detects tab switches & distractions. Stay accountable with focus scores." },
  { icon: BarChart3, title: "Growth Analytics", desc: "Visualize your study progress with charts. See what's working." },
  { icon: Shield, title: "Admin Dashboard", desc: "Teachers/admins monitor student engagement and progress in real-time." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold gradient-text">StudyFlow AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
              <Zap className="h-3.5 w-3.5" /> AI-Powered Study Platform
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Study Smarter,{" "}
              <span className="gradient-text">Not Harder</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              StudyFlow AI transforms how students learn. Get instant summaries, smart quizzes, 
              flashcards, and focus tracking — all powered by AI that works behind the scenes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow text-base px-8">
                  Start Studying Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-base px-8 border-border hover:bg-secondary">
                  I Have an Account
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to <span className="gradient-text">Ace Your Studies</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No chatbots. No gimmicks. Just intelligent tools that process your content and deliver results.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 hover:border-primary/30 transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            <span className="gradient-text-accent">3 Steps</span> to Better Grades
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Paste Your Notes", desc: "Upload or type any study material. No login required to try." },
              { step: "02", title: "AI Does the Work", desc: "Our AI summarizes, generates quizzes, and creates flashcards instantly." },
              { step: "03", title: "Track & Improve", desc: "See your progress charts, focus scores, and growth over time." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="text-5xl font-bold gradient-text mb-4">{s.step}</div>
                <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="glass-card p-12 text-center max-w-3xl mx-auto gradient-border">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Study Game?</h2>
            <p className="text-muted-foreground mb-8">Join thousands of students using AI to study smarter. Free to start.</p>
            <Link to="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-10 text-base">
                Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> Free tier available</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> No credit card</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> AI-powered</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span>StudyFlow AI © 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built for Samyak Hackathon</span>
            <Link to="/admin-login" className="flex items-center gap-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors text-xs">
              <Shield className="h-3 w-3" /> Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
