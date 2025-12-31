/**
 * Shared utility helpers for the frontend.
 * Currently exposes className merging for Tailwind + clsx usage.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
