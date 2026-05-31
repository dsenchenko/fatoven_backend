import { AppError } from "./errors";

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const RESERVED_USERNAMES = new Set([
  "login",
  "register",
  "profile",
  "daily",
  "history",
  "dashboard",
  "progress",
  "weekly",
  "food",
  "garmin",
  "coach",
  "stats",
  "api",
  "health",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertValidUsername(raw: string): string {
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      400,
      "Username must be 3–30 characters: lowercase letters, numbers, underscore",
      "invalid_username",
    );
  }
  if (RESERVED_USERNAMES.has(username)) {
    throw new AppError(400, "This username is reserved", "reserved_username");
  }
  return username;
}

export function isValidUsername(raw: string): boolean {
  try {
    assertValidUsername(raw);
    return true;
  } catch {
    return false;
  }
}

export function suggestUsername(displayName?: string | null, email?: string): string | null {
  const fromDisplay = displayName
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

  if (fromDisplay && isValidUsername(fromDisplay)) {
    return fromDisplay;
  }

  const emailLocal = email?.split("@")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

  if (emailLocal && isValidUsername(emailLocal)) {
    return emailLocal;
  }

  return null;
}
