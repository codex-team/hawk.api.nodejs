import crypto from 'crypto';
import argon2 from 'argon2';

/**
 * Generates new password for user
 *
 * @param passwordLength - length of new password
 */
export async function generatePassword(passwordLength = 16): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(passwordLength, (err, buff) => {
      if (err) {
        return reject(err);
      }

      resolve(buff.toString('hex'));
    });
  });
}

/**
 * Compare password with hash
 *
 * @param hashedPassword - hashed password to compare with
 * @param password - password to compare
 */
export async function comparePasswords(hashedPassword: string, password: string): Promise<boolean> {
  return argon2.verify(hashedPassword, password);
}

/**
 * Creates hash for password
 *
 * @param password - password to hash
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}
