import * as crypto from 'crypto';

/**
 * Generate a secure random password
 * @param length - Length of password (default: 12)
 * @param options - Password generation options
 * @returns Generated password
 */
export function generateSecurePassword(
  length: number = 12,
  options?: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
    excludeAmbiguous?: boolean; // Exclude characters like 0, O, l, 1, I
  },
): string {
  const defaults = {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  };

  const config = { ...defaults, ...options };

  // Character sets
  let uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let lowercase = 'abcdefghijkmnopqrstuvwxyz';
  let numbers = '23456789';
  let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Include ambiguous characters if not excluded
  if (!config.excludeAmbiguous) {
    uppercase += 'IO';
    lowercase += 'l';
    numbers = '0123456789';
  }

  // Build character pool
  let charset = '';
  if (config.includeUppercase) charset += uppercase;
  if (config.includeLowercase) charset += lowercase;
  if (config.includeNumbers) charset += numbers;
  if (config.includeSymbols) charset += symbols;

  if (!charset) {
    throw new Error('At least one character type must be included');
  }

  // Generate password
  let password = '';
  const randomBytes = crypto.randomBytes(length * 2); // Extra bytes for better distribution

  // Ensure at least one character from each selected type
  const requiredChars: string[] = [];
  if (config.includeUppercase) requiredChars.push(uppercase[crypto.randomInt(uppercase.length)]);
  if (config.includeLowercase) requiredChars.push(lowercase[crypto.randomInt(lowercase.length)]);
  if (config.includeNumbers) requiredChars.push(numbers[crypto.randomInt(numbers.length)]);
  if (config.includeSymbols) requiredChars.push(symbols[crypto.randomInt(symbols.length)]);

  // Fill remaining length with random characters
  for (let i = requiredChars.length; i < length; i++) {
    const randomIndex = randomBytes[i] % charset.length;
    requiredChars.push(charset[randomIndex]);
  }

  // Shuffle the array using Fisher-Yates algorithm
  for (let i = requiredChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
  }

  password = requiredChars.join('');

  return password;
}

/**
 * Generate a secure random password with default settings
 * Suitable for temporary passwords that require user change
 */
export function generateDefaultPassword(): string {
  return generateSecurePassword(12, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false, // Exclude symbols for easier manual entry
    excludeAmbiguous: true,
  });
}

/**
 * Generate a highly secure password for sensitive accounts
 */
export function generateStrongPassword(): string {
  return generateSecurePassword(16, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  });
}

/**
 * Generate a numeric PIN
 * @param length - Length of PIN (default: 6)
 */
export function generateNumericPin(length: number = 6): string {
  const numbers = '0123456789';
  let pin = '';

  for (let i = 0; i < length; i++) {
    pin += numbers[crypto.randomInt(numbers.length)];
  }

  return pin;
}
