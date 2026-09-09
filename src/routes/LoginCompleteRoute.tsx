import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function LoginCompleteRoute() {
  const { user, ready, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (user) {
      navigate("/", { replace: true });
      return;
    }

    // Okta can briefly report an unauthenticated state while it restores the
    // newly received tokens. Do not turn that normal transition into a login
    // failure; a real provisioning failure is surfaced by AuthProvider.
    if (!error) return;
    navigate("/login", {
      replace: true,
      state: { authError: error },
    });
  }, [error, navigate, ready, user]);

  return (
    <main className="grid min-h-screen place-items-center text-slate-500">
      Preparing your portal…
    </main>
  );
}
