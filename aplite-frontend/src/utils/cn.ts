/**
 * Class name composition helper for conditional Tailwind classes.
 * Keeps class string building in one lightweight, dependency-free helper.
 */

type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, boolean>;

function toClassString(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(toClassString).filter(Boolean).join(" ");
  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClassString).filter(Boolean).join(" ");
}
