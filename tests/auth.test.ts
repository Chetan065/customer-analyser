import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Native Password Authentication", () => {
  it("hashes password and verifies successfully with correct password", () => {
    const rawPassword = "superSecretPassword123!";
    const storedHash = hashPassword(rawPassword);

    expect(storedHash).toBeDefined();
    expect(storedHash).toContain(":");

    const [salt, hash] = storedHash.split(":");
    expect(salt.length).toBe(32); // 16 bytes in hex
    expect(hash.length).toBe(128); // 64 bytes in hex (sha512)

    const isValid = verifyPassword(rawPassword, storedHash);
    expect(isValid).toBe(true);
  });

  it("fails verification with incorrect password", () => {
    const rawPassword = "correctPassword";
    const storedHash = hashPassword(rawPassword);

    const isWrongValid = verifyPassword("wrongPassword", storedHash);
    expect(isWrongValid).toBe(false);
  });

  it("produces unique hashes for identical passwords due to random salting", () => {
    const pass = "samePassword";
    const hashA = hashPassword(pass);
    const hashB = hashPassword(pass);

    expect(hashA).not.toBe(hashB);
    expect(verifyPassword(pass, hashA)).toBe(true);
    expect(verifyPassword(pass, hashB)).toBe(true);
  });

  it("handles malformed hashes safely without throwing", () => {
    expect(verifyPassword("pass", "")).toBe(false);
    expect(verifyPassword("pass", "malformedStringWithoutColon")).toBe(false);
  });
});
