import { useState, useEffect } from "react";
import { CreditCard, Check, Crown, Zap, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    icon: Zap,
    features: ["5 AI summaries/day", "3 quizzes/day", "Basic flashcards", "Focus tracker", "7-day analytics"],
    color: "border-border",
    buttonVariant: "outline" as const,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹199",
    period: "/month",
    icon: Star,
    popular: true,
    features: ["Unlimited summaries", "Unlimited quizzes", "Unlimited flashcards", "Advanced analytics", "Priority AI models", "Export to PDF"],
    color: "border-primary",
    buttonVariant: "default" as const,
  },
  {
    id: "premium",
    name: "Premium",
    price: "₹499",
    period: "/month",
    icon: Crown,
    features: ["Everything in Pro", "AI doubt solver", "Study planner", "Group study rooms", "Admin dashboard access", "24/7 priority support"],
    color: "border-chart-3",
    buttonVariant: "outline" as const,
  },
];

const Billing = () => {
  const [currentPlan, setCurrentPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) setCurrentPlan(data.plan);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === currentPlan) return;
    setUpgrading(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Upsert subscription
      const { error } = await supabase.from("subscriptions").upsert({
        user_id: session.user.id,
        plan: planId,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: planId === "free" ? null : new Date(Date.now() + 30 * 86400000).toISOString(),
      }, { onConflict: "user_id" });

      if (error) throw error;
      setCurrentPlan(planId);
      toast({
        title: planId === "free" ? "Downgraded to Free" : `Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)}!`,
        description: planId === "free" ? "Your plan has been changed." : "Enjoy your new features! (Demo mode — no real payment)",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-chart-4" /> Billing & Plans
        </h1>
        <p className="text-muted-foreground">Choose the plan that fits your study needs</p>
      </div>

      {/* Current plan banner */}
      <div className="glass-card p-4 mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Current Plan</p>
          <p className="text-lg font-bold gradient-text capitalize">{currentPlan}</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">Active</span>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={`glass-card p-6 relative ${plan.color} ${plan.popular ? "ring-2 ring-primary" : ""}`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                Most Popular
              </div>
            )}
            <div className="flex items-center gap-2 mb-4">
              <plan.icon className={`h-5 w-5 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="text-lg font-bold">{plan.name}</h3>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground text-sm">{plan.period}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              variant={plan.buttonVariant}
              className={`w-full ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
              disabled={currentPlan === plan.id || !!upgrading}
              onClick={() => handleSubscribe(plan.id)}
            >
              {upgrading === plan.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentPlan === plan.id ? (
                "Current Plan"
              ) : currentPlan !== "free" && plan.id === "free" ? (
                "Downgrade"
              ) : (
                "Upgrade Now"
              )}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        🔒 Demo mode — no real payments are processed. Plans are simulated for hackathon purposes.
      </p>
    </div>
  );
};

export default Billing;
