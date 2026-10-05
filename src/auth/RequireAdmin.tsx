import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user?.isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}
