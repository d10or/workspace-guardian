/**
 * Offline license keys for the Pro tier. Format: WG1.<payload-base64url>.<ed25519-signature-base64url>.
 * Only the PUBLIC key lives here. Verification never touches the network. The free core works without a key.
 */
import { createHash, createPublicKey, verify } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAWRGdrKJ3oeBfcT+Sk56aUuaePhAvDBv4QiZMRm2g28o=
-----END PUBLIC KEY-----
`;

export type LicensePayload = { v: 1; id: string; email_hash: string; tier: string; issued: string; expires: string | null; seats: number };
export type LicenseStatus =
  | { status: "valid"; payload: LicensePayload; key: string }
  | { status: "expired"; payload: LicensePayload; key: string }
  | { status: "invalid"; reason: string }
  | { status: "none" };

export function guardianHome(): string {
  if (process.env.GUARDIAN_HOME) return process.env.GUARDIAN_HOME;
  const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude");
  return path.join(cfg, "guardian");
}
export const licenseFile = () => path.join(guardianHome(), "license.json");

export function verifyKey(key: string, today = new Date().toISOString().slice(0, 10)): LicenseStatus {
  const parts = key.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "WG1") return { status: "invalid", reason: "not a WG1 key" };
  let payloadBuf: Buffer;
  let sig: Buffer;
  try {
    payloadBuf = Buffer.from(parts[1]!, "base64url");
    sig = Buffer.from(parts[2]!, "base64url");
  } catch {
    return { status: "invalid", reason: "malformed" };
  }
  const pem = process.env.GUARDIAN_PUBKEY_PEM || PUBLIC_KEY_PEM;
  let ok = false;
  try {
    ok = verify(null, payloadBuf, createPublicKey(pem), sig);
  } catch {
    ok = false;
  }
  if (!ok) return { status: "invalid", reason: "signature does not verify" };
  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadBuf.toString("utf8"));
  } catch {
    return { status: "invalid", reason: "payload is not JSON" };
  }
  if (payload.v !== 1 || typeof payload.id !== "string" || typeof payload.tier !== "string") return { status: "invalid", reason: "unknown payload" };
  if (payload.expires && payload.expires < today) return { status: "expired", payload, key: key.trim() };
  return { status: "valid", payload, key: key.trim() };
}

export function currentLicense(): LicenseStatus {
  try {
    const { key } = JSON.parse(readFileSync(licenseFile(), "utf8"));
    return typeof key === "string" ? verifyKey(key) : { status: "invalid", reason: "license.json has no key" };
  } catch {
    return { status: "none" };
  }
}

export function saveLicense(key: string): void {
  mkdirSync(path.dirname(licenseFile()), { recursive: true });
  writeFileSync(licenseFile(), JSON.stringify({ key: key.trim(), addedAt: new Date().toISOString() }, null, 2) + "\n");
}

export const removeLicense = () => rmSync(licenseFile(), { force: true });

export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
