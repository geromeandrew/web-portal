import { OktaAuth } from "@okta/okta-auth-js";
import { configureAccessTokenProvider } from "../lib/apiClient";

const origin = window.location.origin;
const clientId = import.meta.env.VITE_OKTA_CLIENT_ID;
const issuer =
  import.meta.env.VITE_OKTA_ISSUER ||
  "https://globemfa.okta.com/oauth2/default";

if (!clientId) {
  throw new Error(
    "Missing VITE_OKTA_CLIENT_ID. Set it in .env for pnpm local or in the EKS build configuration.",
  );
}

export const oktaConfig = {
  clientId,
  issuer: issuer.replace(/\/$/, ""),
  redirectUri: `${origin}/login/callback`,
  postLogoutRedirectUri: `${origin}/logout`,
  scopes: ["openid", "profile", "email"],
  pkce: true,
  storageManager: {
    token: {
      storageType: "sessionStorage" as const,
      storageTypes: [],
    },
  },
  tokenManager: {
    storageKey: "esatp.okta.tokens",
  },
};

export const oktaAuth = new OktaAuth(oktaConfig);

configureAccessTokenProvider({
  get: () => oktaAuth.getOrRenewAccessToken(),
  async renew() {
    const token = await oktaAuth.tokenManager.renew("accessToken");
    return token && "accessToken" in token ? token.accessToken : null;
  },
});
