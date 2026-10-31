export type ClerkConfig =
  | { configured: true }
  | { configured: false; issues: string[] };

const PUBLISHABLE_PREFIX = /^pk_(test|live)_/;
const SECRET_PREFIX = /^sk_(test|live)_/;

export function readClerkConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): ClerkConfig {
  const issues: string[] = [];
  const publishable = readKey(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", PUBLISHABLE_PREFIX);
  const secret = readKey(env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY", SECRET_PREFIX);
  if (publishable) issues.push(publishable);
  if (secret) issues.push(secret);
  if (issues.length > 0) return { configured: false, issues };
  return { configured: true };
}

function readKey(value: string | undefined, name: string, prefix: RegExp): string | null {
  if (value === undefined || value.trim() === "") {
    return `${name} is not set. Editing and publishing are closed.`;
  }
  if (value !== value.trim() || /\s/.test(value) || !prefix.test(value) || value.length < 20) {
    return `${name} is not a usable Clerk key. Editing and publishing are closed.`;
  }
  return null;
}
