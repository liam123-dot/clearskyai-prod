import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a string for human readability by splitting on underscores and capitalizing each word
 * @param str - The string to format (e.g., "query_estate_agent")
 * @returns Formatted string (e.g., "Query Estate Agent")
 */
export function formatLabelForDisplay(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

