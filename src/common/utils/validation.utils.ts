import { BadRequestException } from '@nestjs/common';

export class ValidationUtils {
  /**
   * Nigerian phone number regex pattern
   * Supports: +2348012345678, 08012345678
   * Networks: MTN (0803, 0806, 0813, 0816, 0803, 0806, 0810, 0814, 0903, 0906)
   *          Airtel (0802, 0808, 0812, 0701, 0708, 0901, 0902, 0904, 0907, 0912)
   *          Glo (0805, 0807, 0815, 0811, 0705, 0905, 0915)
   *          9mobile (0809, 0817, 0818, 0819, 0908, 0909)
   */
  static readonly NIGERIAN_PHONE_REGEX = /^(\+234|0)[789][01]\d{8}$/;

  /**
   * Email regex pattern (RFC 5322 compliant)
   */
  static readonly EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  /**
   * Validates Nigerian phone number
   * @param phone - Phone number to validate
   * @returns boolean - Whether the phone number is valid
   */
  static isValidNigerianPhone(phone: string): boolean {
    if (!phone) return false;
    return this.NIGERIAN_PHONE_REGEX.test(phone.trim());
  }

  /**
   * Validates email address
   * @param email - Email address to validate
   * @returns boolean - Whether the email is valid
   */
  static isValidEmail(email: string): boolean {
    if (!email) return false;
    return this.EMAIL_REGEX.test(email.trim().toLowerCase());
  }

  /**
   * Normalizes Nigerian phone number to +234 format
   * @param phone - Phone number to normalize
   * @returns string - Normalized phone number
   */
  static normalizeNigerianPhone(phone: string): string {
    if (!phone) return phone;

    const cleaned = phone.trim().replace(/\s+/g, '');

    // If already starts with +234, return as is
    if (cleaned.startsWith('+234')) {
      return cleaned;
    }

    // If starts with 0, replace with +234
    if (cleaned.startsWith('0')) {
      return '+234' + cleaned.substring(1);
    }

    // If starts with 234, add +
    if (cleaned.startsWith('234')) {
      return '+' + cleaned;
    }

    return phone; // Return original if can't normalize
  }

  /**
   * Normalizes email address to lowercase
   * @param email - Email address to normalize
   * @returns string - Normalized email address
   */
  static normalizeEmail(email: string): string {
    if (!email) return email;
    return email.trim().toLowerCase();
  }

  /**
   * Validates and throws error if phone number is invalid
   * @param phone - Phone number to validate
   * @param fieldName - Name of the field for error message
   * @throws BadRequestException if invalid
   */
  static validatePhone(phone: string, fieldName: string = 'phone'): void {
    if (!this.isValidNigerianPhone(phone)) {
      throw new BadRequestException(
        `${fieldName} must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)`
      );
    }
  }

  /**
   * Validates and throws error if email is invalid
   * @param email - Email address to validate
   * @param fieldName - Name of the field for error message
   * @throws BadRequestException if invalid
   */
  static validateEmail(email: string, fieldName: string = 'email'): void {
    if (!this.isValidEmail(email)) {
      throw new BadRequestException(`Please provide a valid ${fieldName} address`);
    }
  }

  /**
   * Validates contact information (email and/or phone)
   * @param email - Email address (optional)
   * @param phone - Phone number (optional)
   * @param requireAtLeastOne - Whether at least one contact method is required
   * @throws BadRequestException if validation fails
   */
  static validateContactInfo(
    email?: string,
    phone?: string,
    requireAtLeastOne: boolean = false
  ): void {
    if (requireAtLeastOne && !email && !phone) {
      throw new BadRequestException('At least one contact method (email or phone) is required');
    }

    if (email) {
      this.validateEmail(email);
    }

    if (phone) {
      this.validatePhone(phone);
    }
  }

  /**
   * Bulk validation for arrays of data
   * @param data - Array of objects to validate
   * @param validator - Validation function
   * @returns Array of validation results
   */
  static bulkValidate<T>(
    data: T[],
    validator: (item: T, index: number) => { isValid: boolean; errors: string[] }
  ): {
    validItems: T[];
    invalidItems: Array<{ item: T; index: number; errors: string[] }>;
    summary: { total: number; valid: number; invalid: number };
  } {
    const validItems: T[] = [];
    const invalidItems: Array<{ item: T; index: number; errors: string[] }> = [];

    data.forEach((item, index) => {
      const result = validator(item, index);
      if (result.isValid) {
        validItems.push(item);
      } else {
        invalidItems.push({ item, index, errors: result.errors });
      }
    });

    return {
      validItems,
      invalidItems,
      summary: {
        total: data.length,
        valid: validItems.length,
        invalid: invalidItems.length
      }
    };
  }
}