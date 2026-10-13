import { z } from 'zod';

/**
 * Zod schema for strictly validating a 10-digit mobile phone number.
 * Enforces:
 * - Strictly required (non-empty)
 * - Exactly 10 numeric digits (0-9)
 * - Completely rejects any letters, words, spaces, or non-numeric symbols
 */
export const mobilePhoneSchema = z
  .string({
    required_error: 'Mobile number is required.',
    invalid_type_error: 'Mobile number must be a valid string.'
  })
  .trim()
  .min(1, { message: 'Mobile number is required.' })
  .regex(/^[0-9]{10}$/, {
    message: 'Mobile number must be exactly 10 digits (numbers only).'
  });

/**
 * Zod schema for strictly validating a 6-digit OTP code.
 * Enforces:
 * - Strictly required (non-empty)
 * - Exactly 6 numeric digits (0-9)
 */
export const otpSchema = z
  .string({
    required_error: 'OTP is required.',
    invalid_type_error: 'OTP must be a valid string.'
  })
  .trim()
  .min(1, { message: 'OTP is required.' })
  .regex(/^[0-9]{6}$/, {
    message: 'OTP must be exactly 6 digits (numbers only).'
  });

/**
 * Zod schema for Talk to Agent request submission.
 */
export const talkToAgentSchema = z.object({
  phone: mobilePhoneSchema,
  notes: z.string().optional()
});

export type TalkToAgentFormData = z.infer<typeof talkToAgentSchema>;

