import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Brain, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_INVITE_CODE = import.meta.env.VITE_ADMIN_INVITE_CODE || "STUDYFLOW-ADMIN-2026";

const AdminSignup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode !== ADMIN_INVITE_CODE) {
      toast({ title: "Invalid invite code", description: "Please contact your system administrator.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Failed to create user");

      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      if (roleError) throw roleError;

      toast({ title: "Admin account created!", description: "You can now sign in as admin." });
      navigate("/admin-login");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <Brain className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold gradient-text">StudyFlow AI</span>
        </Link>
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Admin Account</h1>
              <p className="text-muted-foreground text-sm">Requires an admin invite code</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 mt-4 rounded-lg bg-accent/10 border border-accent/20 text-sm text-accent">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Admin accounts have full access to all user data. Only create this for authorised administrators.</span>
          </div>

          <div className="my-6 h-px bg-border/50" />

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Admin Name" required className="mt-1 bg-secondary border-border" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com" required className="mt-1 bg-secondary border-border" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6}
                  className="bg-secondary border-border pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="invite">Admin Invite Code</Label>
              <Input id="invite" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code" required className="mt-1 bg-secondary border-border font-mono" />
              <p className="text-xs text-muted-foreground mt-1">Contact your system admin for the invite code.</p>
            </div>
            <Button type="submit"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              disabled={loading}>
              {loading ? "Creating account..." : "Create Admin Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an admin account? <Link to="/admin-login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSignup;