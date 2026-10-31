export function readPgCode(error: unknown): string | undefined {
  const direct = codeOf(error);
  if (direct) return direct;
  if (typeof error === "object" && error !== null && "cause" in error) {
    return codeOf(error.cause);
  }
  return undefined;
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}
