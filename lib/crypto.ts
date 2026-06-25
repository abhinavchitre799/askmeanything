/**
 * Symmetric encryption for secrets stored at rest (per-project LLM API keys).
 *
 * AES-256-GCM. The 32-byte key is derived (sha256) from APP_ENCRYPTION_KEY so
 * any passphrase length works. Ciphertext is serialized as "iv:tag:data" (all
 * base64) into a single column.
 *
 * If APP_ENCRYPTION_KEY is unset we fall back to a fixed DEV key and warn once.
 * That keeps local dev runnable but is NOT safe for production — set a real key.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let warnedAboutDevKey = false;

function deriveKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!secret) {
    if (!warnedAboutDevKey) {
      // eslint-disable-next-line no-console
      console.warn(
        "[crypto] APP_ENCRYPTION_KEY is not set — using an insecure dev key. " +
          "Set APP_ENCRYPTION_KEY before storing real API keys in production."
      );
      warnedAboutDevKey = true;
    }
    return createHash("sha256").update("askmeanything-insecure-dev-key").digest();
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypt plaintext -> "iv:tag:ciphertext" (base64 parts). */
export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypt a value produced by encryptSecret(). Throws if tampered/garbled. */
export function decryptSecret(serialized: string): string {
  const parts = serialized.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Mask a key for display: keep a short suffix, hide the rest. */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  const tail = plaintext.slice(-4);
  return `••••••••${tail}`;
}
