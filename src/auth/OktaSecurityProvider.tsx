import type { OktaAuth } from "@okta/okta-auth-js";
import { Security } from "@okta/okta-react";
import { useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { oktaAuth } from "./okta";

export function OktaSecurityProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const restoreOriginalUri = useCallback(
    async (_client: OktaAuth, _originalUri: string) => {
      navigate("/login/complete", { replace: true });
    },
    [navigate],
  );

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      {children}
    </Security>
  );
}
