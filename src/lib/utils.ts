import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Encodes a string to be used as a Firestore document ID by replacing slashes.
 * @param id The original ID, which may contain slashes.
 * @returns A Firestore-safe document ID.
 */
export function encodeFirestoreId(id: string): string {
  return id.replace(/\//g, '__SLASH__');
}

/**
 * Decodes a Firestore document ID back to its original format.
 * @param encodedId The Firestore-safe document ID.
 * @returns The original ID with slashes.
 */
export function decodeFirestoreId(encodedId: string): string {
  return encodedId.replace(/__SLASH__/g, '/');
}
