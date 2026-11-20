"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import { formatUtcDateTime, getCurrentUtcIso } from "@/lib/time";
import {
  AlertIcon,
  appButtonClass,
  appCheckboxClass,
  appTextareaClass,
  appLabelClass,
  appStickyBarClass,
  ClockIcon,
  EditIcon,
  FileIcon,
  heroActionClass,
  LogoutIcon,
  PageShell,
  SectionCard,
  SlimStatCard,
  SoftIcon,
  UsersIcon,
} from "@/components/siro-ui";

type OpenShift = {
  id: number;
  shift_code: string;
  operational_date: string;
  start_time_utc: string | null;
  opening_notes: string | null;
  status: string;
  opened_by: string | null;
  validated_at_utc: string | null;
};

type OccurrenceRow = {
  id: number;
  occurrence_number: string;
  severity: string;
  occurrence_at_utc: string;
  requires_followup: boolean;
};

type PositionLog = {
  id: number;
  user_id: string;
  entered_at_utc: string;
  left_at_utc: string | null;
  notes: string | null;
};

function extractCompositionLines(openingNotes: string | null) {
  if (!openingNotes) return [];

  const marker = "Composição do turno:";
  const idx = openingNotes.indexOf(marker);

  if (idx === -1) return [];

  return openingNotes
    .slice(idx + marker.length)
    .trim()
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CloseShiftPage() {
  const router = useRouter();
  const verificationGeneration = useRef(0);
  const handoverShiftId = useRef<number | null>(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [verifiedShiftId, setVerifiedShiftId] = useState<number | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);

  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openedByName, setOpenedByName] = useState<string>("—");
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([]);
  const [positionLogs, setPositionLogs] = useState<PositionLog[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [hasActivePositionLog, setHasActivePositionLog] = useState(false);
  const [activePositionLogCount, setActivePositionLogCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const canUseVerification =
    !loading && !verificationFailed && openShift !== null &&
    verifiedShiftId === openShift.id;

  const retryVerification = () => {
    verificationGeneration.current += 1;
    setVerificationAttempt(verificationGeneration.current);
    setVerifiedShiftId(null);
    setVerificationFailed(false);
    setLoading(true);
    setConfirmClose(false);
    setMessage("");
    setMessageType("");
  };

  const pendingFollowups = useMemo(
    () => occurrences.filter((item) => item.requires_followup).length,
    [occurrences],
  );
  const requiresValidationBeforeClose = occurrences.length > 0;
  const activePositionLogMessage =
    activePositionLogCount > 1
      ? `Existem ${activePositionLogCount} CTA ainda registados na posição operacional. Regista as saídas antes de encerrar o turno.`
      : "Existe um CTA ainda registado na posição operacional. Regista a saída antes de encerrar o turno.";

  useEffect(() => {
    let active = true;
    const isCurrent = () =>
      active && verificationGeneration.current === verificationAttempt;
    const failVerification = (detail: string) => {
      if (!isCurrent()) return;
      setVerifiedShiftId(null);
      setVerificationFailed(true);
      setMessage(detail);
      setMessageType("error");
      setLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isCurrent()) return;

        if (!user) {
          failVerification("Sessão não encontrada.");
          return;
        }

        setCurrentUserId(user.id);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, role, ats_unit_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!isCurrent()) return;

        if (profileError || !profileData) {
          failVerification("Não foi possível carregar o perfil.");
          return;
        }

        if (!profileData.ats_unit_id) {
          failVerification("Perfil sem órgão ATS associado.");
          return;
        }

        const { data: openShiftData, error: openShiftError } = await supabase
          .from("shifts")
          .select(
            "id, shift_code, operational_date, start_time_utc, opening_notes, status, opened_by, validated_at_utc",
          )
          .eq("ats_unit_id", profileData.ats_unit_id)
          .eq("status", "OPEN")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isCurrent()) return;

        if (openShiftError) {
          failVerification(getFriendlyErrorMessage(
            "Não foi possível verificar se existe um turno aberto",
            openShiftError.message,
          ));
          return;
        }

        if (!openShiftData) {
          handoverShiftId.current = null;
          setHandoverNotes("");
          setOpenShift(null);
          setOpenedByName("—");
          setLoading(false);
          return;
        }

        if (handoverShiftId.current !== openShiftData.id) {
          handoverShiftId.current = openShiftData.id;
          setHandoverNotes("");
        }
        setOpenShift(openShiftData as OpenShift);

        let nextOpenedByName = "—";
        if (openShiftData.opened_by) {
          try {
            const { data: openerProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", openShiftData.opened_by)
              .maybeSingle();
            nextOpenedByName = openerProfile?.full_name || "—";
          } catch {
            // Display enrichment must not decide whether the turn can close.
          }
        }
        if (!isCurrent()) return;
        setOpenedByName(nextOpenedByName);

        const { data: occurrenceData, error: occurrenceError } = await supabase
          .from("occurrences")
          .select(
            "id, occurrence_number, severity, occurrence_at_utc, requires_followup",
          )
          .eq("shift_id", openShiftData.id)
          .order("occurrence_at_utc", { ascending: true });

        if (!isCurrent()) return;

        if (occurrenceError || !Array.isArray(occurrenceData)) {
          failVerification(getFriendlyErrorMessage(
            "Não foi possível verificar as ocorrências deste turno",
            occurrenceError?.message,
          ));
          return;
        }

        setOccurrences(occurrenceData as OccurrenceRow[]);

        const [
          { count: activeLogCount, error: activeLogError },
          { data: positionLogsData, error: positionLogsError },
        ] = await Promise.all([
          supabase
            .from("shift_position_logs")
            .select("id", { count: "exact", head: true })
            .eq("shift_id", openShiftData.id)
            .is("left_at_utc", null),
          supabase
            .from("shift_position_logs")
            .select("id, user_id, entered_at_utc, left_at_utc, notes")
            .eq("shift_id", openShiftData.id)
            .order("entered_at_utc", { ascending: true }),
        ]);

        if (!isCurrent()) return;

        if (activeLogError || positionLogsError ||
            typeof activeLogCount !== "number" || !Number.isInteger(activeLogCount) ||
            activeLogCount < 0 || !Array.isArray(positionLogsData)) {
          failVerification(getFriendlyErrorMessage(
            "Não foi possível verificar as posições operacionais deste turno",
            activeLogError?.message || positionLogsError?.message,
          ));
          return;
        }

        const logs = positionLogsData as PositionLog[];
        const confirmedActiveCount = Math.max(
          activeLogCount, logs.filter((log) => log.left_at_utc === null).length,
        );
        setActivePositionLogCount(confirmedActiveCount);
        setHasActivePositionLog(confirmedActiveCount > 0);
        setPositionLogs(logs);

        const uniqueUserIds = Array.from(new Set(logs.map((item) => item.user_id)));
        let nextUserNames: Record<string, string> = {};
        if (uniqueUserIds.length > 0) {
          try {
            const { data: profileRows } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", uniqueUserIds);
            nextUserNames = (profileRows || []).reduce<Record<string, string>>((acc, item) => {
              acc[item.id] = item.full_name || item.email;
              return acc;
            }, {});
          } catch {
            // Names are optional; the log records and active count are not.
          }
        }

        if (!isCurrent()) return;
        setUserNameMap(nextUserNames);
        setVerifiedShiftId(openShiftData.id);
        setLoading(false);
      })().catch(() => {
        failVerification("Não foi possível concluir a verificação do turno.");
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [verificationAttempt]);

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!openShift) {
      setMessage("Não existe turno aberto para encerrar.");
      setMessageType("error");
      return;
    }

    if (!canUseVerification || verificationGeneration.current !== verificationAttempt) {
      setMessage("Não foi possível confirmar os requisitos de fecho. Tenta verificar novamente.");
      setMessageType("error");
      return;
    }

    if (!confirmClose) {
      setMessage("Confirma o encerramento do turno antes de continuar.");
      setMessageType("error");
      return;
    }

    if (hasActivePositionLog) {
      setMessage(activePositionLogMessage);
      setMessageType("error");
      return;
    }

    if (!currentUserId || openShift.opened_by !== currentUserId) {
      setMessage(
        `Só o utilizador ${openedByName} que abriu o turno pode efetuar o seu encerramento.`,
      );
      setMessageType("error");
      return;
    }

    if (requiresValidationBeforeClose && !openShift.validated_at_utc) {
      setMessage("O registo ATS deve ser validado antes do encerramento do turno.");
      setMessageType("error");
      return;
    }

    setClosing(true);
    setMessage("");
    setMessageType("");

    const endIso = getCurrentUtcIso();

    const { error } = await supabase
      .from("shifts")
      .update({
        status: "CLOSED",
        end_time_utc: endIso,
        handover_notes: handoverNotes.trim() || null,
      })
      .eq("id", openShift.id);

    if (error) {
      setMessage(
        getFriendlyErrorMessage("Não foi possível encerrar o turno", error.message),
      );
      setMessageType("error");
      setClosing(false);
      return;
    }

    setMessage("Turno encerrado com sucesso.");
    setMessageType("success");
    setConfirmClose(false);

    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 700);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "border-red-300 bg-red-100 text-red-800";
      case "HIGH":
        return "border-orange-300 bg-orange-100 text-orange-800";
      case "MEDIUM":
        return "border-amber-300 bg-amber-100 text-amber-800";
      default:
        return "border-emerald-300 bg-emerald-100 text-emerald-800";
    }
  };

  const canCloseShift =
    !!openShift && !!currentUserId && openShift.opened_by === currentUserId;
  const canConfirmClose = canUseVerification && canCloseShift && !hasActivePositionLog &&
    (!requiresValidationBeforeClose || !!openShift?.validated_at_utc);
  const compositionLines = useMemo(
    () => extractCompositionLines(openShift?.opening_notes ?? null),
    [openShift?.opening_notes],
  );

  return (
    <PageShell
      badge="Encerramento do turno"
      title="Fechar turno"
      subtitle=""
      heroIcon={<LogoutIcon />}
      compact
      heroThin
      actions={
        <>
          <Link href="/occurrences" className={heroActionClass()}>
            Registos ATS
          </Link>

          <Link href="/" className={heroActionClass()}>
            Painel principal
          </Link>
        </>
      }
    >
      {message && !verificationFailed && (
        <div
          className={`mb-6 rounded-[0.9rem] border px-4 py-4 text-sm ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {loading ? (
        <SectionCard
          icon={
            <SoftIcon tone="slate">
              <ClockIcon />
            </SoftIcon>
          }
          title="A carregar"
          subtitle="A verificar turno ativo."
        >
          <div className="text-sm text-slate-500">A carregar...</div>
        </SectionCard>
      ) : verificationFailed || (openShift && !canUseVerification) ? (
        <SectionCard
          icon={<SoftIcon tone="amber"><AlertIcon /></SoftIcon>}
          title="Não foi possível verificar o turno"
          subtitle={message || "As ocorrências e as posições precisam de ser confirmadas antes do fecho."}
        >
          <button type="button" onClick={retryVerification} className={heroActionClass("primary")}>
            Tentar novamente
          </button>
        </SectionCard>
      ) : !openShift ? (
        <SectionCard
          icon={
            <SoftIcon tone="amber">
              <AlertIcon />
            </SoftIcon>
          }
          title="Nenhum turno aberto"
          subtitle="Não existe turno ativo para encerrar."
        >
          <button
            type="button"
            onClick={() => router.push("/shifts/open")}
            className={heroActionClass("primary")}
          >
            Abrir turno
          </button>
        </SectionCard>
      ) : (
        <form onSubmit={handleCloseShift} className="space-y-6">
          {!canCloseShift && (
            <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Só o utilizador <span className="font-semibold">{openedByName}</span> que abriu o turno pode efetuar o seu encerramento.
            </div>
          )}

          {canCloseShift && requiresValidationBeforeClose && !openShift.validated_at_utc && (
            <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              O registo ATS deve ser validado antes do encerramento do turno.
            </div>
          )}

          {canCloseShift && !requiresValidationBeforeClose && (
            <div className="rounded-[0.9rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              Este turno não tem ocorrências ATS registadas. O encerramento pode ser efetuado sem validação de ocorrências.
            </div>
          )}

          {hasActivePositionLog && (
            <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              {activePositionLogCount > 1 ? (
                <>
                  Existem <span className="font-semibold">{activePositionLogCount} CTA</span> ainda registados na posição operacional. Regista as saídas em <span className="font-semibold">Logs operacionais</span> antes do encerramento do turno.
                </>
              ) : (
                <>
                  Existe um CTA ainda registado na posição operacional. Regista a saída em <span className="font-semibold">Logs operacionais</span> antes do encerramento do turno.
                </>
              )}
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.4fr_1fr_1fr]">
            <SlimStatCard
              icon={
                <SoftIcon tone="orange">
                  <FileIcon />
                </SoftIcon>
              }
              label="Referência do turno"
              value={openShift.shift_code}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="blue">
                  <ClockIcon />
                </SoftIcon>
              }
              label="Data operacional"
              value={openShift.operational_date}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="emerald">
                  <FileIcon />
                </SoftIcon>
              }
              label="Entradas"
              value={occurrences.length}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="amber">
                  <AlertIcon />
                </SoftIcon>
              }
              label="Seguimento"
              value={pendingFollowups}
              noWrap
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              icon={
                <SoftIcon tone="blue">
                  <ClockIcon />
                </SoftIcon>
              }
              title="Resumo do turno"
              subtitle="Dados principais antes do encerramento."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-surface-subtle rounded-[0.9rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Início UTC
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {formatUtcDateTime(openShift.start_time_utc)}
                  </p>
                </div>

                <div className="app-surface-subtle rounded-[0.9rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Estado atual
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {openShift.status}
                  </p>
                </div>

                <div className="app-surface-subtle rounded-[0.9rem] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Notas de abertura
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {openShift.opening_notes?.trim() || "—"}
                  </p>
                </div>

                <div className="app-surface-subtle rounded-[0.9rem] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[0.65rem] border border-slate-200 bg-white text-slate-600">
                      <UsersIcon />
                    </span>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Composição do turno
                    </p>
                  </div>
                  {compositionLines.length ? (
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-800">
                      {compositionLines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Sem composição registada.</p>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={
                <SoftIcon tone="orange">
                  <EditIcon />
                </SoftIcon>
              }
              title="Notas de fecho"
              subtitle="Regista handover, pendências e observações finais."
            >
              <div className="space-y-3">
                <div>
                  <label className={appLabelClass()}>
                    Passagem de serviço / notas finais
                  </label>
                  <textarea
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    rows={8}
                    className={appTextareaClass()}
                    placeholder="Escreve aqui o resumo final do turno, pendências ou orientações para o turno seguinte..."
                  />
                </div>

                <label className="app-surface-subtle flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-slate-50/80 p-3.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmClose}
                    onChange={(e) => setConfirmClose(e.target.checked)}
                    disabled={!canConfirmClose}
                    className={appCheckboxClass()}
                  />
                  <span>
                    <span className="block font-medium text-slate-900">
                      Confirmo o encerramento do turno
                    </span>
                    <span className="mt-1 block text-slate-600">
                      Verifiquei os dados principais do turno e pretendo
                      concluir o fecho.
                    </span>
                  </span>
                </label>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            icon={
              <SoftIcon tone="slate">
                <UsersIcon />
              </SoftIcon>
            }
            title="Logs operacionais"
            subtitle="Posições ocupadas durante o turno."
          >
            {positionLogs.length === 0 ? (
              <div className="app-surface-subtle rounded-[0.9rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Não existem logs operacionais registados neste turno.
              </div>
            ) : (
              <div className="space-y-3">
                {positionLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="app-surface-subtle rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Registo {index + 1}
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-slate-900">
                          {userNameMap[log.user_id] || "—"}
                        </p>
                      </div>
                      <span className="rounded-[0.7rem] border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {log.left_at_utc ? "Concluído" : "Em curso"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Entrada
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatUtcDateTime(log.entered_at_utc)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Saída
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatUtcDateTime(log.left_at_utc)}
                        </p>
                      </div>
                    </div>

                    {log.notes && (
                      <p className="mt-3 text-sm text-slate-600">
                        Nota: {log.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={
              <SoftIcon tone="violet">
                <FileIcon />
              </SoftIcon>
            }
            title="Entradas registadas"
            subtitle="Resumo rápido das entradas associadas ao turno."
          >
            {occurrences.length === 0 ? (
              <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Não existem entradas registadas neste turno.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[0.9rem] border border-slate-200">
                {occurrences.map((item, index) => (
                  <div
                    key={item.id}
                    className={`bg-white px-5 py-4 ${
                      index !== occurrences.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px_120px] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.occurrence_number}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatUtcDateTime(item.occurrence_at_utc)}
                        </p>
                      </div>

                      <div>
                        <span
                          className={`rounded-[0.6rem] border px-3 py-1 text-xs font-semibold ${getSeverityBadge(
                            item.severity,
                          )}`}
                        >
                          {item.severity}
                        </span>
                      </div>

                      <div className="text-sm text-slate-600 lg:text-right">
                        {item.requires_followup
                          ? "Requer seguimento"
                          : "Sem seguimento"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className={appStickyBarClass()}>
            <div className="text-sm leading-6 text-slate-500">
              Ao encerrar, o turno passa para{" "}
              <span className="font-medium text-slate-700">CLOSED</span> e a
              sessão permanece ativa para consulta posterior.
            </div>

            <button
              type="submit"
              disabled={closing || !confirmClose || !canConfirmClose}
              className={appButtonClass("primary")}
            >
              {closing ? "A encerrar..." : "Encerrar turno"}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
