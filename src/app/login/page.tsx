"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Invalid credentials");
      }

      toast.success(`Welcome back, ${json.data.user.name || json.data.user.email}!`);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to start demo session");
      }

      toast.success("Welcome to your isolated PulseIQ demo workspace!");
      if (json.data?.projectId) {
        router.push(`/projects/${json.data.projectId}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err: any) {
      toast.error("Demo login failed: " + err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex flex-col justify-center items-center p-4">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pulse<span className="text-primary ml-1">IQ</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to access your customer intelligence projects and roadmaps.
          </p>
        </div>

        {/* Card */}
        <Card className="shadow-lg border">
          <form onSubmit={handleLogin}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Sign In</CardTitle>
              <CardDescription className="text-xs">
                Enter your email and password below.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-9 text-xs"
                    disabled={loading || demoLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-9 text-xs"
                    disabled={loading || demoLoading}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-9 text-xs" disabled={loading || demoLoading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground text-[10px]">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleDemoLogin}
                disabled={loading || demoLoading}
                className="w-full h-9 text-xs gap-2"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>{demoLoading ? "Creating private demo workspace..." : "Instant Demo (Isolated Workspace)"}</span>
              </Button>
            </CardContent>

            <CardFooter className="flex justify-center border-t py-3 text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline ml-1">
                Create Account
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
