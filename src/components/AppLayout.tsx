import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, BarChart3, LogOut } from "lucide-react";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, isOwner, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Today" },
    { path: "/classes", icon: BookOpen, label: "Classes" },
    ...(isOwner ? [{ path: "/dashboard", icon: BarChart3, label: "Dashboard" }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-card/90 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="font-display text-lg font-bold text-foreground tracking-tight">FS Register</h1>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="container flex-1 py-8 pb-28">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/60 bg-card/95 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-around">
          {navItems.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-5 py-1.5 text-[10px] tracking-wide uppercase transition-colors ${
                isActive(path)
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive(path) ? "stroke-[2]" : "stroke-[1.5]"}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
