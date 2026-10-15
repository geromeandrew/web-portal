import { getOktaConfig } from "../src/auth/okta";

vi.mock("@okta/okta-auth-js", () => ({
  OktaAuth: vi.fn(),
}));

describe("Okta frontend configuration", () => {
  it.each([
    [
      "http://localhost:5173",
      "0oa28lk9m5953nLCA0h8",
      "https://globemfa.okta.com/oauth2/default",
    ],
    [
      "https://esatp-dv.globetel.cloud",
      "0oa28rhxcsp6MAfDL0h8",
      "https://globemfa.okta.com/oauth2/default",
    ],
    [
      "https://esatp-st.globetel.cloud",
      "0oa1nijkhqleYMa9B0x8",
      "https://globemfa.okta.com/oauth2/default",
    ],
    [
      "https://esatp.globetel.cloud",
      "0oa28rhxcsp6MAfDL0h8",
      "https://globe.okta.com/oauth2/default",
    ],
  ])("uses the expected credentials for %s", (origin, clientId, issuer) => {
    expect(getOktaConfig(origin)).toMatchObject({ clientId, issuer });
  });

  it("derives Okta callback URLs from the active origin", () => {
    expect(getOktaConfig("https://esatp-st.globetel.cloud")).toMatchObject({
      redirectUri: "https://esatp-st.globetel.cloud/login/callback",
      postLogoutRedirectUri: "https://esatp-st.globetel.cloud/logout",
    });
  });

  it("rejects an origin without an explicit Okta configuration", () => {
    expect(() => getOktaConfig("https://preview.esatp.globetel.cloud")).toThrow(
      "Unsupported Okta frontend origin",
    );
  });
});
