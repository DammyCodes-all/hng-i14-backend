export const normalizeName = (value: string): string => value.trim();
export const normalizeLower = (value: string | null | undefined): string | null =>
  value ? String(value).trim().toLowerCase() : null;
export const normalizeUpper = (value: string | null | undefined): string | null =>
  value ? String(value).trim().toUpperCase() : null;
