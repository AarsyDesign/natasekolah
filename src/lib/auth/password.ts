import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/**
 * Melakukan hashing password menggunakan bcryptjs dengan cost factor 12.
 * Catatan Keamanan: Jangan pernah mencatat password mentah ke log.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || typeof plainPassword !== "string") {
    throw new Error("Password wajib berupa teks yang valid.");
  }
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Memverifikasi kecocokan antara password mentah dan hash bcrypt.
 * Kebal timing-attack dan tidak pernah mencatat password ke log.
 */
export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  if (!plainPassword || !passwordHash) {
    return false;
  }
  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
}
