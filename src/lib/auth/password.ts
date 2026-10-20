import crypto from "crypto";

/**
 * Hashes a plain-text password using Node.js built-in pbkdf2Sync with a random salt.
 * No external auth or hashing packages required.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored salt:hash string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;

  const hashToVerify = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  const originalBuffer = Buffer.from(originalHash, "hex");
  const verifyBuffer = Buffer.from(hashToVerify, "hex");

  if (originalBuffer.length !== verifyBuffer.length) return false;
  return crypto.timingSafeEqual(originalBuffer, verifyBuffer);
}
