import { OktaAuth } from "@okta/okta-auth-js";
import { configureAccessTokenProvider } from "../lib/apiClient";

const origin = window.location.origin;

export const oktaConfig = {
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID,
  issuer: (
    import.meta.env.VITE_OKTA_ISSUER || "https://globe.okta.com/oauth2/default"
  ).replace(/\/$/, ""),
  redirectUri: `${origin}/login/callback`,
  postLogoutRedirectUri: `${origin}/login`,
  scopes: ["openid", "profile", "email"],
  pkce: true,
  tokenManager: {
    storage: "sessionStorage" as const,
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
