/**
 * Normalize absent or invalid release names without changing opaque identifiers.
 *
 * @param value - raw release name
 * @returns the original identifier, a finite number as a string, or null
 */
export function normalizeReleaseName(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim().toLowerCase();

  return name === '' || name === 'null' || name === 'undefined' || name === 'nan' ? null : value;
}
