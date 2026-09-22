import { z } from "zod";

export const dashboardDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal dashboard harus berformat YYYY-MM-DD.");

export function validateDashboardDate(input: unknown): string {
  return dashboardDateSchema.parse(input);
}
