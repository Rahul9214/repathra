import type { OperatorAccess } from "@/features/journey-studio/model";

export type OperatorAuthorizationInput = {
  clerkConfigured: boolean;
  userId: string | null | undefined;
  email?: string | null;
  emails?: readonly string[] | null;
  role?: string | null;
  roles?: readonly string[] | null;
  orgRole?: string | null;
  orgPermissions?: readonly string[] | null;
  isOperator?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export function isAuthorizedOperator(input: {
  userId: string;
  email?: string | null;
  emails?: readonly string[] | null;
  role?: string | null;
  roles?: readonly string[] | null;
  orgRole?: string | null;
  orgPermissions?: readonly string[] | null;
  isOperator?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): boolean {
  if (input.isOperator === true) return true;
  if (input.role === "operator" || input.role === "admin") return true;
  if (input.roles?.some((r) => r === "operator" || r === "admin")) return true;
  if (
    input.orgRole === "org:operator" ||
    input.orgRole === "org:admin" ||
    input.orgRole === "operator" ||
    input.orgRole === "admin"
  ) {
    return true;
  }
  if (input.orgPermissions?.some((p) => p.includes("operator") || p.includes("admin"))) {
    return true;
  }

  const env = input.env ?? process.env;
  const configuredIds = (env.OPERATOR_USER_IDS ?? env.REPATHRA_OPERATOR_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (configuredIds.includes(input.userId)) {
    return true;
  }

  const configuredEmails = (env.OPERATOR_EMAILS ?? env.REPATHRA_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (configuredEmails.length > 0) {
    const candidateEmails = [
      ...(input.email ? [input.email] : []),
      ...(input.emails ?? []),
    ].map((e) => e.trim().toLowerCase());

    if (candidateEmails.some((candidate) => configuredEmails.includes(candidate))) {
      return true;
    }
  }

  return false;
}

export function authorizeOperator(input: OperatorAuthorizationInput): OperatorAccess {
  if (!input.clerkConfigured) {
    return { state: "denied", code: "auth_not_configured" };
  }
  const userId = input.userId?.trim() ?? "";
  if (!userId) return { state: "denied", code: "unauthenticated" };
  if (!isAuthorizedOperator({ ...input, userId })) {
    return { state: "denied", code: "unauthorized" };
  }
  return { state: "allowed", userId };
}

