"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import {
  AlertIcon,
  appButtonClass,
  appLabelClass,
  appTextareaClass,
  ClockIcon,
  heroActionClass,
  PageShell,
  SectionCard,
  SelectField,
  SlimStatCard,
  SoftIcon,
  UsersIcon,
} from "@/components/siro-ui";

type Profile = {
  id: string;
  full_name: string | null;
  email?: string | null;
  ats_unit_id: number | null;
};

type OpenShift = {
  id: number;
  shift_code: string;
  operational_date: string;
  status: string;
  opening_notes: string | null;
  opened_by: string | null;
};

type UnitUser = {
  id: string;
  full_name: string | null;
  email: string;
};

type PositionLog = {
  id: number;
  user_id: string;
  entered_at_utc: string;
  left_at_utc: string | null;
  notes: string | null;
};

function getOperationalUtcIso() {
  return new Date().toISOString();
}

function getSafeExitIso(enteredAtUtc: string) {
  const now = new Date();
  const enteredAt = new Date(enteredAtUtc);
  return new Date(Math.max(now.getTime(), enteredAt.getTime())).toISOString();
}

function formatUtcDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function extractCompositionLabels(openingNotes: string | null) {
  if (!openingNotes) return [];

  const marker = "Composição do turno:";
  const idx = openingNotes.indexOf(marker);

  if (idx === -1) return [];

  return openingNotes
    .slice(idx + marker.length)
    .trim()
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(":").slice(1).join(":").trim())
    .filter(Boolean);
}

function extractSupervisorLabel(openingNotes: string | null) {
  if (!openingNotes) return null;

  const marker = "Composição do turno:";
  const idx = openingNotes.indexOf(marker);

  if (idx === -1) return null;

  const supervisorLine = openingNotes
    .slice(idx + marker.length)
    .trim()
    .split("|")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith("supervisor:"));

  return supervisorLine
    ? supervisorLine.split(":").slice(1).join(":").trim() || null
    : null;
}

export default function ShiftLogsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [unitUsers, setUnitUsers] = useState<UnitUser[]>([]);
  const [logs, setLogs] = useState<PositionLog[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingExit, setSavingExit] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedExitLogId, setSelectedExitLogId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;

    const initPage = async () => {
      setLoading(true);
      setMessage("");
      setMessageType("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setMessage("Sessão não encontrada.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, ats_unit_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || !profileData) {
        setMessage("Não foi possível carregar o perfil.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      if (!profileData.ats_unit_id) {
        setMessage("Perfil sem órgão ATS associado.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      const [{ data: openShiftData, error: openShiftError }, { data: unitUsersData, error: unitUsersError }] =
        await Promise.all([
          supabase
            .from("shifts")
            .select("id, shift_code, operational_date, status, opening_notes, opened_by")
            .eq("ats_unit_id", profileData.ats_unit_id)
            .eq("status", "OPEN")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("ats_unit_id", profileData.ats_unit_id)
            .order("full_name", { ascending: true }),
        ]);

      if (!active) return;

      if (openShiftError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível verificar o turno aberto",
            openShiftError.message,
          ),
        );
        setMessageType("error");
        setLoading(false);
        return;
      }

      if (unitUsersError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar os utilizadores da unidade",
            unitUsersError.message,
          ),
        );
        setMessageType("error");
        setLoading(false);
        return;
      }

      setOpenShift((openShiftData as OpenShift | null) ?? null);
      const users = (unitUsersData as UnitUser[]) ?? [];
      setUnitUsers(users);
      if (users.length > 0) {
        setSelectedUserId(users[0].id);
      }

      if (!openShiftData) {
        setLogs([]);
        setLoading(false);
        return;
      }

      const { data: logsData, error: logsError } = await supabase
        .from("shift_position_logs")
        .select("id, user_id, entered_at_utc, left_at_utc, notes")
        .eq("shift_id", openShiftData.id)
        .order("entered_at_utc", { ascending: true });

      if (!active) return;

      if (logsError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar os logs operacionais",
            logsError.message,
          ),
        );
        setMessageType("error");
        setLoading(false);
        return;
      }

      setLogs((logsData as PositionLog[]) ?? []);
      setLoading(false);
    };

    void initPage();

    return () => {
      active = false;
    };
  }, []);

  const userNameMap = useMemo(
    () =>
      unitUsers.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.full_name || item.email;
        return acc;
      }, {}),
    [unitUsers],
  );

  const eligibleUsers = useMemo(() => {
    const labels = extractCompositionLabels(openShift?.opening_notes ?? null);

    if (labels.length === 0) {
      return unitUsers;
    }

    const allowed = new Set(labels.map((item) => item.toLowerCase()));

    return unitUsers.filter((item) => {
      const fullName = item.full_name?.trim().toLowerCase();
      const email = item.email.trim().toLowerCase();
      return (fullName && allowed.has(fullName)) || allowed.has(email);
    });
  }, [openShift?.opening_notes, unitUsers]);

  const effectiveSelectedUserId =
    eligibleUsers.some((item) => item.id === selectedUserId)
      ? selectedUserId
      : eligibleUsers[0]?.id || "";
  const supervisorLabel = extractSupervisorLabel(openShift?.opening_notes ?? null);
  const canManagePositionLogs =
    !!profile &&
    !!openShift &&
    !!supervisorLabel &&
    ((profile.full_name?.trim().toLowerCase() || "") === supervisorLabel.toLowerCase() ||
      (profile.email?.trim().toLowerCase() || "") === supervisorLabel.toLowerCase());

  const activeLogs = useMemo(
    () => logs.filter((item) => !item.left_at_utc),
    [logs],
  );

  const selectedExitLog = useMemo(
    () => activeLogs.find((item) => String(item.id) === selectedExitLogId) ?? activeLogs[0] ?? null,
    [activeLogs, selectedExitLogId],
  );

  const handleRegisterEntry = async () => {
    if (!profile?.ats_unit_id || !openShift) {
      setMessage("Não existe turno aberto para registar entrada na posição.");
      setMessageType("error");
      return;
    }

    if (!canManagePositionLogs) {
      setMessage("Só o supervisor do turno pode registar entradas e saídas da posição.");
      setMessageType("error");
      return;
    }

    if (!effectiveSelectedUserId) {
      setMessage("Seleciona o CTA que entrou na posição.");
      setMessageType("error");
      return;
    }

    setSavingEntry(true);
    setMessage("");
    setMessageType("");

    const enteredAtIso = getOperationalUtcIso();

    const { data, error } = await supabase
      .from("shift_position_logs")
      .insert({
        shift_id: openShift.id,
        ats_unit_id: profile.ats_unit_id,
        user_id: effectiveSelectedUserId,
        recorded_by: profile.id,
        entered_at_utc: enteredAtIso,
        notes: notes.trim() || null,
      })
      .select("id, user_id, entered_at_utc, left_at_utc, notes")
      .single();

    if (error || !data) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível registar a entrada na posição",
          error?.message,
        ),
      );
      setMessageType("error");
      setSavingEntry(false);
      return;
    }

    setLogs((current) => [...current, data as PositionLog]);
    setNotes("");
    setMessage("Entrada na posição operacional registada com sucesso.");
    setMessageType("success");
    setSavingEntry(false);
  };

  const handleRegisterExit = async () => {
    if (!selectedExitLog) {
      setMessage("Não existe CTA ativo na posição para registar saída.");
      setMessageType("error");
      return;
    }

    if (!canManagePositionLogs) {
      setMessage("Só o supervisor do turno pode registar entradas e saídas da posição.");
      setMessageType("error");
      return;
    }

    setSavingExit(true);
    setMessage("");
    setMessageType("");

    const exitIso = getSafeExitIso(selectedExitLog.entered_at_utc);

    const { error } = await supabase
      .from("shift_position_logs")
      .update({ left_at_utc: exitIso })
      .eq("id", selectedExitLog.id);

    if (error) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível registar a saída da posição",
          error.message,
        ),
      );
      setMessageType("error");
      setSavingExit(false);
      return;
    }

    setLogs((current) =>
      current.map((item) =>
        item.id === selectedExitLog.id ? { ...item, left_at_utc: exitIso } : item,
      ),
    );
    setMessage("Saída da posição operacional registada com sucesso.");
    setMessageType("success");
    setSavingExit(false);
  };

  return (
    <PageShell
      badge="Logs operacionais"
      title="Logs operacionais"
      subtitle=""
      heroIcon={<UsersIcon />}
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
      {message && (
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
          subtitle="A preparar os logs operacionais."
        >
          <div className="text-sm text-slate-500">A carregar...</div>
        </SectionCard>
      ) : !openShift ? (
        <SectionCard
          icon={
            <SoftIcon tone="amber">
              <AlertIcon />
            </SoftIcon>
          }
          title="Sem turno aberto"
          subtitle="É necessário existir um turno ativo para registar entradas e saídas da posição operacional."
        >
          <Link href="/shifts/open" className={heroActionClass("primary")}>
            Abrir turno
          </Link>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {!canManagePositionLogs && (
            <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Só o supervisor que abriu o turno pode registar entradas e saídas da posição. Os restantes utilizadores podem apenas consultar os logs.
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-3">
            <SlimStatCard
              icon={
                <SoftIcon tone="blue">
                  <ClockIcon />
                </SoftIcon>
              }
              label="Turno"
              value={openShift.shift_code}
              noWrap
            />
            <SlimStatCard
              icon={
                <SoftIcon tone="slate">
                  <UsersIcon />
                </SoftIcon>
              }
              label="CTA na posição"
              value={activeLogs.length > 0 ? `${activeLogs.length} ativo(s)` : "Sem CTA ativo"}
              noWrap
            />
            <SlimStatCard
              icon={
                <SoftIcon tone="orange">
                  <ClockIcon />
                </SoftIcon>
              }
              label="Data operacional"
              value={openShift.operational_date}
              noWrap
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              icon={
                <SoftIcon tone="blue">
                  <UsersIcon />
                </SoftIcon>
              }
              title="Posição operacional"
              subtitle="Registo de quem entrou e saiu da posição operacional durante o turno."
            >
              <div className="space-y-5">
                {activeLogs.length > 0 && (
                  <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      CTA ativos
                    </p>

                    <div className="mt-3 space-y-3">
                      {activeLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-[0.8rem] border border-slate-200 bg-white px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[15px] font-semibold text-slate-900">
                              {userNameMap[log.user_id] || "—"}
                            </p>
                            <span className="rounded-[0.65rem] border border-blue-200 bg-[#eef4fb] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1d4f91]">
                              Em posição
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Entrada na posição: {formatUtcDateTime(log.entered_at_utc)}
                          </p>
                          {log.notes && (
                            <p className="mt-1 text-sm text-slate-600">
                              Nota: {log.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className={appLabelClass()}>
                        CTA que entrou na posição
                      </label>
                      <SelectField
                        value={effectiveSelectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        disabled={!canManagePositionLogs}
                      >
                        <option value="">
                          {eligibleUsers.length > 0
                            ? "Selecionar CTA"
                            : "Sem CTA na composição do turno"}
                        </option>
                        {eligibleUsers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.full_name || item.email}
                          </option>
                        ))}
                      </SelectField>
                    </div>

                    <div>
                      <label className={appLabelClass()}>
                        Nota
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        className={appTextareaClass()}
                        placeholder="Observação opcional sobre a entrada na posição."
                        disabled={!canManagePositionLogs}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleRegisterEntry}
                      disabled={savingEntry || !canManagePositionLogs}
                      className={appButtonClass("primary")}
                    >
                      {savingEntry ? "A registar entrada..." : "Registar entrada na posição"}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={appLabelClass()}>
                        CTA a registar saída
                      </label>
                      <SelectField
                        value={selectedExitLog ? String(selectedExitLog.id) : ""}
                        onChange={(e) => setSelectedExitLogId(e.target.value)}
                        disabled={activeLogs.length === 0 || !canManagePositionLogs}
                      >
                        {activeLogs.length === 0 ? (
                          <option value="">Sem CTA ativo</option>
                        ) : (
                          activeLogs.map((log) => (
                            <option key={log.id} value={String(log.id)}>
                              {userNameMap[log.user_id] || "—"}
                              {log.notes ? ` — ${log.notes}` : ""}
                            </option>
                          ))
                        )}
                      </SelectField>
                    </div>

                    {selectedExitLog && (
                      <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Seleção atual
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-slate-900">
                          {userNameMap[selectedExitLog.user_id] || "—"}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Entrada na posição: {formatUtcDateTime(selectedExitLog.entered_at_utc)}
                        </p>
                        {selectedExitLog.notes && (
                          <p className="mt-1 text-sm text-slate-600">
                            Nota: {selectedExitLog.notes}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleRegisterExit}
                      disabled={savingExit || activeLogs.length === 0 || !canManagePositionLogs}
                      className={appButtonClass("primary")}
                    >
                      {savingExit ? "A registar saída..." : "Registar saída da posição"}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={
                <SoftIcon tone="slate">
                  <ClockIcon />
                </SoftIcon>
              }
              title="Histórico do turno"
              subtitle="Sequência cronológica das trocas na posição operacional."
            >
              {logs.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Ainda não existem logs operacionais registados para este turno.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log, index) => (
                    <div
                      key={log.id}
                      className="rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4"
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
          </div>
        </div>
      )}
    </PageShell>
  );
}
