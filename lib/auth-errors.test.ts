import { describe, expect, it } from "vitest";
import { getAuthSignInErrorMessage } from "@/lib/auth-errors";

describe("getAuthSignInErrorMessage", () => {
  it("explains email throttling without exposing a provider error", () => {
    expect(getAuthSignInErrorMessage({ message: "Email rate limit exceeded", status: 429 }))
      .toContain("newest Aurelian email");
  });

  it("uses a neutral message for other authentication failures", () => {
    expect(getAuthSignInErrorMessage({ message: "Unexpected provider failure" }))
      .toBe("We could not send a sign-in email. Please wait a moment and try again.");
  });
});
