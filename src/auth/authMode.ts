/**
 * Enables the normal Okta Authorization Code + PKCE flow.
 */
export const ENABLE_OKTA_AUTH = true;

let testOverride: boolean | null = null;

export function isOktaAuthEnabled() {
  return testOverride ?? ENABLE_OKTA_AUTH;
}

export function setOktaAuthEnabledForTests(value: boolean | null) {
  testOverride = value;
}
