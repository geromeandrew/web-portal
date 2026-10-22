import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireModule({
  moduleId,
  children,
}: {
  moduleId: string;
  children: React.ReactNode;
}) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user?.modules?.some((module) => module.moduleId === moduleId) ? (
    <>{children}</>
  ) : (
    <Navigate to="/" replace />
  );
}
