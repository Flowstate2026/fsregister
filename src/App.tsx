import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import TodayClasses from "./pages/TodayClasses";
import ClassRegister from "./pages/ClassRegister";
import StudentProfile from "./pages/StudentProfile";
import AllClasses from "./pages/AllClasses";
import RetentionDashboard from "./pages/RetentionDashboard";
import Admin from "./pages/Admin";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><TodayClasses /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><AllClasses /></ProtectedRoute>} />
            <Route path="/register/:classId" element={<ProtectedRoute><ClassRegister /></ProtectedRoute>} />
            <Route path="/student/:studentId" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><RetentionDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
