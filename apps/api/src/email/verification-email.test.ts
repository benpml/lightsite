import { describe, expect, it } from "vitest";
import {
  getVerificationEmailSubject,
  renderVerificationEmail,
  renderVerificationEmailText,
} from "./verification-email";

describe("verification email", () => {
  it("renders the branded Handout email with the verification code", () => {
    const html = renderVerificationEmail("482913");

    expect(html).toContain("https://app.handout.link/handout-logo.svg");
    expect(html).toContain("Your Handout verification code is 482913");
    expect(html).toContain("Use 482913 to confirm your email");
    expect(html).toContain("Confirm your email");
    expect(html).toContain(">482913</span>");
    expect(html).toContain("background-color:#fafafa");
    expect(html).toContain("expires in 10 minutes");
    expect(html).toContain("https://handout.link");
  });

  it("puts the code in the subject for notification visibility", () => {
    expect(getVerificationEmailSubject("482913"))
      .toBe("Your Handout verification code is 482913");
  });

  it("escapes unexpected verification-code content in HTML", () => {
    const html = renderVerificationEmail('<script>alert("no")</script>');

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;");
  });

  it("provides a complete plain-text fallback", () => {
    const text = renderVerificationEmailText("482913");

    expect(text).toContain("Your Handout verification code is 482913.");
    expect(text).toContain("expires in 10 minutes");
    expect(text).toContain("safely ignore this email");
  });
});
