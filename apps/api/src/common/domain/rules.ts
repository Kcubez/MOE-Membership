import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
export const reason = z.string().trim().min(1).max(500);
export const version = z.number().int().min(1).max(2147483647);
export const visits = z.number().int().min(1).max(2147483647);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= '1900-01-01'
    );
  }, 'Use a valid calendar date');
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(128).optional(),
  search: z.string().trim().max(120).optional(),
});
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const data = schema.safeParse(value);
  if (!data.success)
    throw new BadRequestException({
      code: 'INVALID_INPUT',
      message: 'Check the required fields and valid calendar dates.',
    });
  return data.data;
}
export function dates(start: string, end: string) {
  if (end < start)
    throw new BadRequestException({
      code: 'INVALID_INPUT',
      message: 'End date cannot be before start date.',
    });
  return {
    startDate: new Date(`${start}T00:00:00.000Z`),
    endDate: new Date(`${end}T00:00:00.000Z`),
  };
}
export function conflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}
export function yangonToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
export type MembershipStatus =
  'Cancelled' | 'Completed' | 'Expired' | 'Upcoming' | 'Active';
export function membershipStatus(
  item: {
    cancelledAt: Date | null;
    totalVisits: number;
    usedVisits: number;
    startDate: Date;
    endDate: Date;
  },
  now = new Date(),
): MembershipStatus {
  const today = yangonToday(now);
  return item.cancelledAt
    ? 'Cancelled'
    : item.usedVisits >= item.totalVisits
      ? 'Completed'
      : item.endDate.toISOString().slice(0, 10) < today
        ? 'Expired'
        : item.startDate.toISOString().slice(0, 10) > today
          ? 'Upcoming'
          : 'Active';
}
