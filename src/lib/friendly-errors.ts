function normalizeErrorMessage(message: string | null | undefined) {
  return (message || "").trim().toLowerCase();
}

export function getFriendlyErrorMessage(
  context: string,
  message: string | null | undefined,
) {
  const normalized = normalizeErrorMessage(message);

  if (!normalized) {
    return `${context}. Tenta novamente.`;
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return "Email ou palavra-passe incorretos.";
  }

  if (
    normalized.includes("jwt") ||
    normalized.includes("session") ||
    normalized.includes("auth session missing")
  ) {
    return "A tua sessão expirou. Entra novamente.";
  }

  if (normalized.includes("duplicate key")) {
    return `${context}. Já existe um registo igual.`;
  }

  if (normalized.includes("violates not-null constraint")) {
    return `${context}. Falta preencher um dado obrigatório.`;
  }

  if (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch")
  ) {
    return "Não foi possível comunicar com o servidor. Verifica a ligação e tenta novamente.";
  }

  return `${context}.`;
}
