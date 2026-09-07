/**
 * TEMPORARY LOCAL UI-REVIEW SWITCH.
 *
 * Set this to true before restoring the normal Okta flow or deploying the
 * frontend. Keep it false only while the matching local API bypass is active.
 */
export const ENABLE_OKTA_AUTH = false;

let testOverride: boolean | null = null;

export function isOktaAuthEnabled() {
  return testOverride ?? ENABLE_OKTA_AUTH;
}

export function setOktaAuthEnabledForTests(value: boolean | null) {
  testOverride = value;
}
