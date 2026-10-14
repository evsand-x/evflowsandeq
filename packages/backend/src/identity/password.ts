import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltValue, hashValue] = storedHash.split(":");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;

  const expected = Buffer.from(hashValue, "base64url");
  const actual = (await scrypt(
    password,
    Buffer.from(saltValue, "base64url"),
    expected.length,
  )) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
