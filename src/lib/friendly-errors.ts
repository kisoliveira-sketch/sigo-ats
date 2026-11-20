function normalizeErrorMessage(message: string | null | undefined) {
  return (message || "").trim().toLowerCase();
}

export function getFriendlyErrorMessage(
  context: string,
  message: string | null | undefined,
) {
  const normalized = normalizeErrorMessage(message);

  switch (normalized) {
    case "sigo_lifecycle_denied":
      return "Não tens permissão para esta ação neste turno.";
    case "sigo_lifecycle_state_changed":
      return "O estado do turno mudou. Atualiza a página antes de continuar.";
    case "sigo_lifecycle_active_positions":
      return "Ainda existem posições operacionais ativas. Regista as saídas antes de continuar.";
    case "sigo_lifecycle_needs_validation":
      return "O registo ATS deve ser validado antes do encerramento do turno.";
    case "sigo_lifecycle_no_occurrences":
      return "Este turno não tem ocorrências ATS para validar.";
    case "sigo_lifecycle_occurrences_validated":
      return "O registo ATS já foi validado. As ocorrências deste turno não podem ser alteradas.";
    case "sigo_lifecycle_retry":
      return "Não foi possível confirmar o estado atual do turno. Atualiza a página e tenta novamente.";
  }

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
