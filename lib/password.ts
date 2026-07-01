import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const HEX_KEY_PATTERN = /^[0-9a-fA-F]+$/;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [algorithm, salt, key] = parts;
  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }
  if (key.length % 2 !== 0 || !HEX_KEY_PATTERN.test(key)) {
    return false;
  }

  const expectedKey = Buffer.from(key, "hex");
  const actualKey = (await scrypt(password, salt, expectedKey.length)) as Buffer;

  if (actualKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(actualKey, expectedKey);
}
