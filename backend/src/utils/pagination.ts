export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.max(1, Math.min(50, Number(query.limit || 12)));
  return { page, limit, skip: (page - 1) * limit };
}

export function sanitizeSearchQuery(value: unknown): string {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s@#&.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
