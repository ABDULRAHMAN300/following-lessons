import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Turns a caught exception from a server-function call into a specific,
 * user-facing Arabic message instead of a generic one-size-fits-all string.
 *
 * A `TypeError` from `fetch` (or being offline) means the request never
 * reached the server — that's a real connectivity problem. Anything else
 * means the request DID reach the server and something there threw
 * unexpectedly (a bug, an unhandled edge case) — that's a different
 * problem with a different fix, so it gets a different message rather
 * than being lumped in with "check your connection".
 */
export function describeRequestError(error: unknown, unexpectedMessage: string): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "لا يوجد اتصال بالإنترنت. تحقق من الشبكة ثم حاول مجددًا.";
  }
  if (error instanceof TypeError) {
    return "تعذر الاتصال بالخادم. تحقق من الاتصال ثم حاول مجددًا.";
  }
  return unexpectedMessage;
}
