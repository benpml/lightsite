import { describe, expect, it } from "vitest"
import { cleanRecipientName } from "./gmail-adapter"

describe("Gmail recipient display names", () => {
  it("removes the email wrapper without leaving empty parentheses", () => {
    expect(
      cleanRecipientName("Scraper.Tech (admin@scraper.tech)", "admin@scraper.tech"),
    ).toBe("Scraper.Tech")
  })

  it("normalizes angle-bracket contact labels", () => {
    expect(cleanRecipientName("Ada Lovelace <ada@acme.com>", "ada@acme.com")).toBe(
      "Ada Lovelace",
    )
  })
})
