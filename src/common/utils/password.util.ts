import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash password dengan bcrypt. Dipakai saat registrasi/pembuatan user
 * (mis. saat EmployeeService membuat akun login karyawan baru).
 */
export function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, SALT_ROUNDS);
}

/**
 * Bandingkan password plain terhadap hash tersimpan. Dipakai AuthService
 * saat login.
 */
export function comparePassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return compare(plainPassword, passwordHash);
}
