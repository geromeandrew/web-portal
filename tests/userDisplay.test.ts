import { describe, expect, it } from "vitest";
import { getUserDisplayName, getUserFirstName } from "../src/lib/userDisplay";

describe("user display helpers", () => {
  it("prefers the Okta-synced display name over a local fallback email", () => {
    expect(
      getUserDisplayName(
        "Jane Example",
        "okta-e32021d7a866eea9791da1f196de04bb5fa1b285f48e6a11ef37726870c6ed37@identity.invalid",
      ),
    ).toBe("Jane Example");
    expect(getUserFirstName("Jane Example")).toBe("Jane");
  });
});
