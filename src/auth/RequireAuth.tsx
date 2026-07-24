import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <main className="grid min-h-screen place-items-center text-slate-500">Loading secure portal…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}
