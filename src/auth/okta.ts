import { OktaAuth } from "@okta/okta-auth-js";
import { configureAccessTokenProvider } from "../lib/apiClient";

const oktaByOrigin = {
  "http://localhost:5173": {
    clientId: "0oa28rfcq0h2ZSAvZ0h8",
    issuer: "https://globemfa.okta.com/oauth2/default",
  },
  "https://esatp-dv.globetel.cloud": {
    clientId: "0oa28rhxcsp6MAfDL0h8",
    issuer: "https://globemfa.okta.com/oauth2/default",
  },
  "https://esatp-st.globetel.cloud": {
    clientId: "0oa1nijkhqleYMa9B0x8",
    issuer: "https://globemfa.okta.com/oauth2/default",
  },
  "https://esatp.globetel.cloud": {
    // Temporary production configuration until the dedicated production client ID is available.
    clientId: "0oa28rhxcsp6MAfDL0h8",
    issuer: "https://globe.okta.com/oauth2/default",
  },
} as const;

export function getOktaConfig(origin: string) {
  const environment = oktaByOrigin[origin as keyof typeof oktaByOrigin];

  if (!environment) {
    throw new Error(
      `Unsupported Okta frontend origin: ${origin}. Add its Okta client configuration before deploying to this origin.`,
    );
  }

  return {
    ...environment,
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
}

export const oktaConfig = getOktaConfig(window.location.origin);

export const oktaAuth = new OktaAuth(oktaConfig);

configureAccessTokenProvider({
  get: () => oktaAuth.getOrRenewAccessToken(),
  async renew() {
    const token = await oktaAuth.tokenManager.renew("accessToken");
    return token && "accessToken" in token ? token.accessToken : null;
  },
});
