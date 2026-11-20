import type { SupabaseClient } from "@supabase/supabase-js";

type Shift = {
  id: number;
  shift_code: string;
  status: string;
  operational_date: string;
  opened_by: string | null;
  start_time_utc: string | null;
  validated_at_utc: string | null;
  opening_notes: string | null;
};

type Position = {
  id: number;
  user_id: string;
  entered_at_utc: string;
  left_at_utc: string | null;
  notes: string | null;
};

export type DashboardSnapshot = Awaited<ReturnType<typeof readDashboardSnapshot>>;

export async function readDashboardSnapshot(client: SupabaseClient, unitId: number, signal: AbortSignal) {
  const shifts = () => client.from("shifts").select("id, shift_code, status, operational_date, opened_by, start_time_utc, validated_at_utc, opening_notes")
    .eq("ats_unit_id", unitId).eq("status", "OPEN").order("id", { ascending: false })
    .limit(1).abortSignal(signal).maybeSingle<Shift>();
  const { data: shift, error: shiftError } = await shifts();
  if (shiftError) throw shiftError;

  const latest = await Promise.all([
    client.from("shifts").select("end_time_utc").eq("ats_unit_id", unitId).eq("status", "CLOSED")
      .order("id", { ascending: false }).limit(1).abortSignal(signal).maybeSingle(),
    client.from("occurrences").select("occurrence_at_utc").eq("ats_unit_id", unitId)
      .order("occurrence_at_utc", { ascending: false }).limit(1).abortSignal(signal).maybeSingle(),
    client.from("shift_position_logs").select("entered_at_utc").eq("ats_unit_id", unitId)
      .order("entered_at_utc", { ascending: false }).limit(1).abortSignal(signal).maybeSingle(),
    client.from("shift_position_logs").select("left_at_utc").eq("ats_unit_id", unitId).not("left_at_utc", "is", null)
      .order("left_at_utc", { ascending: false }).limit(1).abortSignal(signal).maybeSingle(),
  ]);
  const candidates = [
    shift?.validated_at_utc,
    shift?.start_time_utc,
    latest[0].data?.end_time_utc,
    latest[1].data?.occurrence_at_utc,
    latest[2].data?.entered_at_utc,
    latest[3].data?.left_at_utc,
  ].filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)));
  const latestEvent = candidates.reduce<string | null>(
    (best, value) => !best || Date.parse(value) > Date.parse(best) ? value : best, null,
  );

  if (!shift) return {
    shift, openerName: "—", latestEvent, positionLogsCount: 0, activePositions: [] as (Position & { user_name: string })[],
    occurrencesCount: 0, pendingCount: 0,
  };
  const scopedOccurrences = () => client.from("occurrences").select("id", { count: "exact", head: true })
    .eq("ats_unit_id", unitId).eq("shift_id", shift.id);
  const scopedPositions = () => client.from("shift_position_logs").select("id", { count: "exact", head: true })
    .eq("ats_unit_id", unitId).eq("shift_id", shift.id);
  const [occurrences, pending, totals, positions] = await Promise.all([
    scopedOccurrences().abortSignal(signal),
    scopedOccurrences().eq("requires_followup", true).abortSignal(signal),
    scopedPositions().abortSignal(signal),
    client.from("shift_position_logs").select("id, user_id, entered_at_utc, left_at_utc, notes")
      .eq("ats_unit_id", unitId).eq("shift_id", shift.id).is("left_at_utc", null)
      .order("entered_at_utc", { ascending: true }).abortSignal(signal).returns<Position[]>(),
  ]);
  const ids = [...new Set([shift.opened_by, ...(positions.data ?? []).map((item) => item.user_id)].filter((id): id is string => !!id))];
  const names = ids.length
    ? await client.from("profiles").select("id, full_name").in("id", ids).abortSignal(signal)
    : { data: [] };
  const nameMap = new Map((names.data ?? []).map((item) => [item.id, item.full_name]));
  return {
    shift, openerName: (shift.opened_by && nameMap.get(shift.opened_by)) || "—", latestEvent,
    positionLogsCount: totals.error ? null : totals.count,
    activePositions: positions.error || !positions.data ? null : positions.data.map((row) => ({
      ...row, user_name: nameMap.get(row.user_id) || "CTA ativo",
    })),
    occurrencesCount: occurrences.error ? null : occurrences.count,
    pendingCount: pending.error ? null : pending.count,
  };
}

type TurnFacts = {
  shiftStatus: "checking" | "unavailable" | "known";
  hasShift: boolean;
  isOpener: boolean;
  validated: boolean;
  occurrences: number | null;
  activePositions: number | null;
};

export function getDashboardTurnAction(facts: TurnFacts) {
  const { shiftStatus, hasShift, isOpener, validated, occurrences, activePositions } = facts;
  const title = hasShift ? "Encerrar turno" : "Abrir turno";
  if (shiftStatus !== "known") {
    const reason = shiftStatus === "checking" ? "A verificar o turno" : "Verificação indisponível";
    return { title, reason, description: reason, needsValidation: false, eligibleToValidate: false, href: null };
  }
  if (!hasShift) return {
    title, reason: null, description: "Iniciar novo turno", needsValidation: false, eligibleToValidate: false, href: "/shifts/open",
  };
  const needsValidation = occurrences !== null && occurrences > 0 && !validated;
  const checksUnavailable = activePositions === null || (occurrences === null && !validated);
  const eligibleToValidate = needsValidation && isOpener && activePositions === 0;
  const reason = [
    needsValidation ? "Validação pendente" : "",
    activePositions !== null && activePositions > 0 ? "Posição ativa" : "",
    !isOpener ? "Só quem abriu" : "",
    checksUnavailable ? "Verificação indisponível" : "",
  ].filter(Boolean).join(" · ") || null;
  const description = needsValidation
    ? isOpener ? "Antes de fechar o turno, é preciso validar as ocorrências."
      : "Antes de fechar o turno, é preciso validar as ocorrências. Só quem abriu o turno o pode encerrar."
    : !isOpener ? "Só quem abriu o turno o pode encerrar." : reason ? "Consultar condições de fecho." : null;
  return { title, reason, description, needsValidation, eligibleToValidate, href: reason ? null : "/shifts/close" };
}

export function getDashboardPrimaryActionKind(facts: {
  turnAction: ReturnType<typeof getDashboardTurnAction>;
  hasOpenShift: boolean;
  checksUnknown: boolean;
  hasAnyPositionLogs: boolean;
  hasActivePositionLogs: boolean;
  canCreateOccurrence: boolean;
  canManagePositionLogs: boolean;
}) {
  if (facts.checksUnknown) return "refresh";
  if (!facts.hasOpenShift) return "open";
  if (facts.hasActivePositionLogs) {
    if (facts.canCreateOccurrence) return "newOccurrence";
    if (facts.canManagePositionLogs) return "managePositions";
    return "history";
  }
  if (facts.turnAction.eligibleToValidate) return "validate";
  // The first position remains a suggested next step, not a new closure requirement.
  if (!facts.hasAnyPositionLogs) return "firstPosition";
  return facts.turnAction.href === "/shifts/close" ? "close" : "history";
}

type RefreshEvents = {
  visible: () => boolean;
  subscribe: (listener: () => void) => () => void;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
};

export function startDashboardRefresh(
  read: (signal: AbortSignal) => Promise<void>,
  events: RefreshEvents,
  interval = 15_000,
) {
  let stopped = false;
  let pending = false;
  let timer: number | undefined;
  let request: AbortController | null = null;

  const cancelTimer = () => {
    if (timer !== undefined) events.clearTimer(timer);
    timer = undefined;
  };
  const refresh = () => {
    if (stopped) return;
    if (!events.visible()) {
      cancelTimer();
      request?.abort();
      return;
    }
    if (pending) return;
    cancelTimer();
    pending = true;
    const controller = new AbortController();
    request = controller;
    void Promise.resolve().then(() => read(controller.signal)).catch(() => {
      // The UI read hook handles its own errors; still keep the scheduler alive.
    }).finally(() => {
      pending = false;
      request = null;
      if (!stopped && events.visible()) timer = events.setTimer(refresh, controller.signal.aborted ? 0 : interval);
    });
  };
  const unsubscribe = events.subscribe(refresh);
  refresh();
  return {
    refresh,
    stop: () => {
      stopped = true;
      cancelTimer();
      request?.abort();
      unsubscribe();
    },
  };
}
