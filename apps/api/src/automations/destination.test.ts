import { describe, expect, it } from "vitest";
import { isBlockedAddress, parseAutomationDestination } from "./destination";

describe("automation destination safety", () => {
  it.each([
    "http://hooks.example.com/x",
    "https://user:pass@hooks.example.com/x",
    "https://hooks.example.com:8443/x",
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://hooks.example.com/x#secret",
  ])("rejects unsafe destination %s", (url) => {
    expect(() => parseAutomationDestination(url)).toThrow();
  });

  it("accepts a normal public HTTPS URL without exposing its path as the display host", () => {
    const parsed = parseAutomationDestination("https://hooks.example.com/secret/token?source=handout");
    expect(parsed.host).toBe("hooks.example.com");
    expect(parsed.pathname).toBe("/secret/token");
  });

  it("only relaxes HTTP for an explicit local development target", () => {
    expect(parseAutomationDestination("http://127.0.0.1:3456/hook", { allowLocal: true }).port).toBe("3456");
    expect(() => parseAutomationDestination("http://hooks.example.com/hook", { allowLocal: true })).toThrow();
  });

  it.each([
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "0:0:0:0:0:0:0:1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
    "3fff::1",
  ])("blocks non-public or transition address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});
