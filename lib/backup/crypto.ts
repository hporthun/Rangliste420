import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32; // 256 bit
const IV_LEN = 16;
const SALT_LEN = 16;

export type EncryptedPayload = {
  encrypted: true;
  /** hex */
  iv: string;
  /** hex – GCM auth tag */
  tag: string;
  /** hex – scrypt salt for key derivation */
  salt: string;
  /** hex – ciphertext */
  data: string;
};

function deriveKey(password: string, salt: Buffer): Buffer {
  // scrypt: cost 2^14, blockSize 8, parallelization 1 → ~64 ms on modern hardware
  return crypto.scryptSync(password, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

export function encryptBackup(plaintext: string, password: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    encrypted: true,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    salt: salt.toString("hex"),
    data: encrypted.toString("hex"),
  };

  return JSON.stringify(payload, null, 2);
}

export function decryptBackup(encryptedJson: string, password: string): string {
  let payload: EncryptedPayload & { salt: string };
  try {
    payload = JSON.parse(encryptedJson);
  } catch {
    throw new Error("Ungültiges Backup-Format.");
  }

  if (payload.encrypted !== true) {
    throw new Error("Backup ist nicht verschlüsselt.");
  }

  try {
    const iv = Buffer.from(payload.iv, "hex");
    const tag = Buffer.from(payload.tag, "hex");
    const salt = Buffer.from(payload.salt, "hex");
    const data = Buffer.from(payload.data, "hex");
    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Entschlüsselung fehlgeschlagen. Falsches Passwort?");
  }
}

/** Check without fully parsing whether a JSON text is an encrypted backup. */
export function isEncryptedJson(text: string): boolean {
  return text.trimStart().startsWith('{\n  "encrypted": true') ||
    text.trimStart().startsWith('{"encrypted":true');
}
