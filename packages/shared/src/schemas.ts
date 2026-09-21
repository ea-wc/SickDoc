import { z } from 'zod';

/**
 * Client- and server-side validation schemas (zod). The API additionally
 * enforces these via class-validator DTOs; these are the shared contract.
 */

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const emailSchema = z
  .string()
  .email('A valid email is required')
  .transform((value) => value.toLowerCase());

/** ISO date `YYYY-MM-DD`. */
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

/** ISO-8601 timestamp with timezone (always UTC on the wire). */
export const timestampSchema = z.string().datetime({ offset: true });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerPatientSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  birthDate: dateOnlySchema.optional(),
  phone: z.string().max(32).optional(),
});

export const registerDoctorSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(20).optional(),
  licenseNumber: z.string().min(1).max(64),
  yearsOfExperience: z.number().int().min(0).max(70).optional(),
  timezone: z.string().min(1).max(64),
  bio: z.string().max(2000).optional(),
  specializationIds: z.array(z.string().uuid()).min(1),
  primarySpecializationId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
export type RegisterDoctorInput = z.infer<typeof registerDoctorSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
