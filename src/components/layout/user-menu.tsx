"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  user?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}

export function UserMenu({ user: initialUser }: UserMenuProps) {
  const router = useRouter();
  const [user, setUser] = React.useState(initialUser);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((json) => {
          if (json.data?.user) {
            setUser(json.data.user);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    } finally {
      setLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => router.push("/login")}
      >
        Sign In
      </Button>
    );
  }

  const displayName = user.name || user.email.split("@")[0];

  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border">
        {displayName[0].toUpperCase()}
      </div>
      <div className="hidden sm:block text-left text-xs">
        <div className="font-semibold text-foreground truncate max-w-[120px]">
          {displayName}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        disabled={loggingOut}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        title="Log out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
