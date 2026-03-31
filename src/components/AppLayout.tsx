import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, BarChart3, LogOut, Shield, Users, StickyNote } from "lucide-react";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isOwner, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const ownerNav = [
    { path: "/", icon: Home, label: "Today" },
    { path: "/classes", icon: BookOpen, label: "Classes" },
    { path: "/dashboard", icon: BarChart3, label: "Dashboard" },
    { path: "/data", icon: Shield, label: "Data" },
  ];

  const teacherNav = [
    { path: "/", icon: Home, label: "Today" },
    { path: "/students", icon: Users, label: "Students" },
    { path: "/notes", icon: StickyNote, label: "Notes" },
  ];

  const navItems = isOwner ? ownerNav : teacherNav;

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-card">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="font-display text-xl text-foreground">FS Register</h1>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="container flex-1 py-10 pb-28">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/40 bg-card">
        <div className="container flex h-16 items-center justify-around">
          {navItems.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-5 py-2 text-[9px] tracking-[0.25em] uppercase transition-colors ${
                isActive(path)
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive(path) ? "stroke-[2]" : "stroke-[1.5]"}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
