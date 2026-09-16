import { LoginCallback, useOktaAuth } from "@okta/okta-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const signInFailureMessage = "We couldn't complete sign-in. Please try again.";

function CallbackError() {
  const { oktaAuth } = useOktaAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await oktaAuth.tokenManager.clear();
      } finally {
        if (active) {
          navigate("/login", {
            replace: true,
            state: { authError: signInFailureMessage },
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate, oktaAuth]);

  return (
    <main className="grid min-h-screen place-items-center text-slate-500">
      Completing sign-in…
    </main>
  );
}

export default function LoginCallbackRoute() {
  return (
    <LoginCallback
      errorComponent={CallbackError}
      loadingElement={
        <main className="grid min-h-screen place-items-center text-slate-500">
          Completing sign-in…
        </main>
      }
    />
  );
}
