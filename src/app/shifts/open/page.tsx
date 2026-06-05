"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import {
  AlertIcon,
  appButtonClass,
  appFieldClass,
  appTextareaClass,
  appLabelClass,
  appStickyBarClass,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  GridIcon,
  HashIcon,
  heroActionClass,
  LoginIcon,
  PageShell,
  SectionCard,
  SelectField,
  SlimStatCard,
  SoftIcon,
  UsersIcon,
} from "@/components/siro-ui";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ats_unit_id: number | null;
};

type AtsUnit = {
  id: number;
  name: string;
  code: string;
  unit_type?: string | null;
};

type UnitUser = {
  id: string;
  email: string;
  full_name: string;
};

type ShiftMember = {
  user_id: string;
  role_in_shift: string;
};

type ExistingOpenShift = {
  id: number;
  shift_code: string;
  operational_date: string;
};

type ShiftOption = {
  label: string;
  suffix: string;
  start: string;
};

const AICE_SHIFT_OPTIONS: ShiftOption[] = [
  { label: "07:00 - 13:00", suffix: "0700/1300", start: "07:00" },
  { label: "13:00 - 19:00", suffix: "1300/1900", start: "13:00" },
  { label: "19:00 - 01:00", suffix: "1900/0100", start: "19:00" },
  { label: "01:00 - 07:00", suffix: "0100/0700", start: "01:00" },
];

const ACC_SAL_SHIFT_OPTIONS: ShiftOption[] = [
  { label: "08:30 - 14:30", suffix: "0830/1430", start: "08:30" },
  { label: "14:30 - 20:30", suffix: "1430/2030", start: "14:30" },
  { label: "20:30 - 00:30", suffix: "2030/0030", start: "20:30" },
  { label: "00:30 - 08:30", suffix: "0030/0830", start: "00:30" },
];

const TWR_AIPNM_SHIFT_OPTIONS: ShiftOption[] = [
  { label: "08:30 - 14:30", suffix: "0830/1430", start: "08:30" },
  { label: "14:30 - 20:30", suffix: "1430/2030", start: "14:30" },
  { label: "20:30 - 00:30", suffix: "2030/0030", start: "20:30" },
  { label: "00:30 - 08:30", suffix: "0030/0830", start: "00:30" },
];

const TWR_BVC_SHIFT_OPTIONS: ShiftOption[] = [
  { label: "09:00 - 19:00", suffix: "0900/1900", start: "09:00" },
];

const DEFAULT_MEMBERS: ShiftMember[] = [
  { user_id: "", role_in_shift: "Supervisor" },
  { user_id: "", role_in_shift: "CTA Operacional" },
];

export default function OpenShiftPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [atsUnit, setAtsUnit] = useState<AtsUnit | null>(null);
  const [unitUsers, setUnitUsers] = useState<UnitUser[]>([]);
  const [existingOpenShift, setExistingOpenShift] =
    useState<ExistingOpenShift | null>(null);
  const [hadOpenShiftOnLoad, setHadOpenShiftOnLoad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [selectedShiftLabel, setSelectedShiftLabel] = useState("");
  const [operationalDate, setOperationalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [openingNotes, setOpeningNotes] = useState("");
  const [members, setMembers] = useState<ShiftMember[]>(DEFAULT_MEMBERS);

  const availableShiftOptions = useMemo(
    () =>
      atsUnit?.code === "ACC_SAL" || atsUnit?.code === "TWR_SAL"
        ? ACC_SAL_SHIFT_OPTIONS
        : atsUnit?.code === "TWR_BVC"
          ? TWR_BVC_SHIFT_OPTIONS
        : atsUnit?.code === "AICE" ||
            atsUnit?.code === "AICE_TWR" ||
            atsUnit?.code === "TWR_AICE"
          ? AICE_SHIFT_OPTIONS
        : atsUnit?.code?.startsWith("TWR_") ||
            atsUnit?.unit_type?.toUpperCase() === "TWR" ||
            atsUnit?.unit_type?.toUpperCase() === "TOWER" ||
            atsUnit?.unit_type?.toUpperCase() === "AERODROME_CONTROL_TOWER"
          ? TWR_AIPNM_SHIFT_OPTIONS
        : AICE_SHIFT_OPTIONS,
    [atsUnit?.code, atsUnit?.unit_type],
  );

  const effectiveSelectedShiftLabel = useMemo(() => {
    const stillValid = availableShiftOptions.some(
      (option) => option.label === selectedShiftLabel,
    );

    return stillValid ? selectedShiftLabel : (availableShiftOptions[0]?.label ?? "");
  }, [availableShiftOptions, selectedShiftLabel]);

  const selectedShift = useMemo(
    () =>
      availableShiftOptions.find((option) => option.label === effectiveSelectedShiftLabel) ??
      availableShiftOptions[0],
    [availableShiftOptions, effectiveSelectedShiftLabel],
  );

  const startTime = selectedShift.start;

  const generatedShiftCode = useMemo(() => {
    if (!atsUnit || !operationalDate || !selectedShift?.suffix) return "";
    const compactDate = operationalDate.replaceAll("-", "");
    return `${atsUnit.code}-${compactDate}-${selectedShift.suffix}`;
  }, [atsUnit, operationalDate, selectedShift]);

  useEffect(() => {
    let active = true;

    const initPage = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setMessage("Sessão não encontrada.");
        setMessageType("error");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, ats_unit_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setMessage("Não foi possível carregar o perfil.");
        setMessageType("error");
        return;
      }

      setProfile(data);

      if (!data.ats_unit_id) {
        setMessage(`O perfil ${data.email} não tem órgão ATS associado.`);
        setMessageType("error");
        setAtsUnit(null);
        return;
      }

      const { data: unitData, error: unitError } = await supabase
        .from("ats_units")
        .select("id, name, code, unit_type")
        .eq("id", data.ats_unit_id)
        .maybeSingle();

      if (!active) return;

      if (unitError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar a unidade ATS",
            unitError.message,
          ),
        );
        setMessageType("error");
        setAtsUnit(null);
        return;
      }

      setAtsUnit(unitData || null);

      const { data: unitUsersData, error: unitUsersError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("ats_unit_id", data.ats_unit_id)
        .order("full_name", { ascending: true });

      if (!active) return;

      if (unitUsersError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar os utilizadores da unidade",
            unitUsersError.message,
          ),
        );
        setMessageType("error");
        setUnitUsers([]);
        return;
      }

      setUnitUsers((unitUsersData as UnitUser[]) || []);

      const { data: openShiftData, error: openShiftError } = await supabase
        .from("shifts")
        .select("id, shift_code, operational_date")
        .eq("ats_unit_id", data.ats_unit_id)
        .eq("status", "OPEN")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (openShiftError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível verificar se já existe um turno aberto",
            openShiftError.message,
          ),
        );
        setMessageType("error");
        return;
      }

      setExistingOpenShift(openShiftData || null);
      setHadOpenShiftOnLoad(!!openShiftData);
    };

    void initPage();

    return () => {
      active = false;
    };
  }, []);

  const updateMember = (
    index: number,
    field: keyof ShiftMember,
    value: string,
  ) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      { user_id: "", role_in_shift: "CTA Operacional" },
    ]);
  };

  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (existingOpenShift) {
      setMessage(
        `Já existe um turno aberto (${existingOpenShift.shift_code}). Feche o turno atual antes de abrir outro.`,
      );
      setMessageType("error");
      return;
    }

    if (!profile?.ats_unit_id) {
      setMessage("Perfil sem órgão ATS associado.");
      setMessageType("error");
      return;
    }

    if (!generatedShiftCode) {
      setMessage("Não foi possível gerar a referência do turno.");
      setMessageType("error");
      return;
    }

    const validMembers = members.filter((member) => member.user_id);
    if (validMembers.length === 0) {
      setMessage("Indica pelo menos um membro no turno.");
      setMessageType("error");
      return;
    }

    const duplicateSelection = validMembers.some(
      (member, index) =>
        validMembers.findIndex((item) => item.user_id === member.user_id) !== index,
    );

    if (duplicateSelection) {
      setMessage(
        "A mesma pessoa não pode ser escolhida mais do que uma vez na composição do turno.",
      );
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Utilizador não autenticado.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    const { data: existingShift, error: existingShiftError } = await supabase
      .from("shifts")
      .select("id, shift_code, operational_date, status")
      .eq("ats_unit_id", profile.ats_unit_id)
      .eq("shift_code", generatedShiftCode)
      .eq("operational_date", operationalDate)
      .maybeSingle();

    if (existingShiftError) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível confirmar se este turno já existe",
          existingShiftError.message,
        ),
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (existingShift) {
      setMessage(
        `Já existe um turno ${existingShift.shift_code} para a data ${existingShift.operational_date}.`,
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    const profileLookup = new Map(unitUsers.map((item) => [item.id, item]));

    const unresolvedMembers = validMembers.filter(
      (member) => !profileLookup.has(member.user_id),
    );

    if (unresolvedMembers.length > 0) {
      setMessage(
        "Há membros selecionados que já não estão disponíveis na unidade. Atualiza a composição do turno e tenta novamente.",
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    const startIso = new Date(
      `${operationalDate}T${startTime}:00Z`,
    ).toISOString();

    const compositionText = validMembers
      .map((member) => {
        const selectedUser = profileLookup.get(member.user_id);
        const memberLabel =
          selectedUser?.full_name || selectedUser?.email || "Utilizador";
        return `${member.role_in_shift}: ${memberLabel}`;
      })
      .join(" | ");

    const notesWithComposition = [
      openingNotes.trim() ? openingNotes.trim() : null,
      compositionText ? `Composição do turno: ${compositionText}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: shiftData, error: shiftError } = await supabase
      .from("shifts")
      .insert({
        ats_unit_id: profile.ats_unit_id,
        shift_code: generatedShiftCode,
        operational_date: operationalDate,
        start_time_utc: startIso,
        status: "OPEN",
        opening_notes: notesWithComposition || null,
        opened_by: user.id,
      })
      .select("id")
      .single();

    if (shiftError || !shiftData) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível abrir o turno",
          shiftError?.message,
        ),
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    const shiftId = shiftData.id;

    const normalizedMembers = validMembers.map((member) => {
      const matchedProfile = profileLookup.get(member.user_id);
      const isSupervisor = member.role_in_shift === "Supervisor";
      const memberLabel =
        matchedProfile?.full_name || matchedProfile?.email || "Utilizador";

      return {
        shift_id: shiftId,
        user_id: matchedProfile?.id ?? user.id,
        role_in_shift: `${member.role_in_shift} · ${memberLabel}`,
        is_present: true,
        notes: isSupervisor
          ? "Supervisor autenticado no momento de abertura do turno."
          : "Membro registado na composição inicial do turno.",
      };
    });

    const { error: staffError } = await supabase
      .from("shift_staff")
      .insert(normalizedMembers);

    if (staffError) {
      await supabase.from("shifts").delete().eq("id", shiftId);
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível guardar a composição do turno",
          staffError.message,
        ),
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    setMessage("Turno iniciado com sucesso.");
    setMessageType("success");
    setExistingOpenShift({
      id: shiftId,
      shift_code: generatedShiftCode,
      operational_date: operationalDate,
    });
    setOpeningNotes("");
    setMembers(DEFAULT_MEMBERS);
    setLoading(false);
  };

  const inputClass = appFieldClass();

  return (
    <PageShell
      badge="Abertura do turno"
      title="Abertura de turno"
      subtitle=""
      heroIcon={<LoginIcon />}
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
      {hadOpenShiftOnLoad && existingOpenShift && (
        <div className="mb-6 rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          Já existe um turno aberto:{" "}
          <span className="font-semibold">{existingOpenShift.shift_code}</span>.
          Fecha o turno atual antes de abrir outro.
        </div>
      )}

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1.5fr_1.3fr_1fr]">
          <SlimStatCard
            icon={
              <SoftIcon tone="orange">
                <HashIcon />
              </SoftIcon>
            }
            label="Referência do turno"
            value={generatedShiftCode || "—"}
            noWrap
          />

          <SlimStatCard
            icon={
              <SoftIcon tone="blue">
                <GridIcon />
              </SoftIcon>
            }
            label="Órgão ATS"
            value={atsUnit?.name || "—"}
            noWrap
          />

          <SlimStatCard
            icon={
              <SoftIcon tone="slate">
                <CalendarIcon />
              </SoftIcon>
            }
            label="Data operacional"
            value={operationalDate}
            noWrap
          />

          <SlimStatCard
            icon={
              <SoftIcon tone="emerald">
                <ClockIcon />
              </SoftIcon>
            }
            label="Hora início UTC"
            value={startTime}
            noWrap
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            icon={
              <SoftIcon tone="blue">
                <EditIcon />
              </SoftIcon>
            }
            title="Dados do turno"
            subtitle="Seleção do período operacional e identificação do órgão."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={appLabelClass()}>
                  Turno
                </label>
                <SelectField
                  value={effectiveSelectedShiftLabel}
                  onChange={(e) => setSelectedShiftLabel(e.target.value)}
                  required
                  disabled={!!existingOpenShift}
                >
                  {availableShiftOptions.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <label className={appLabelClass()}>
                  Data operacional
                </label>
                <input
                  type="date"
                  value={operationalDate}
                  onChange={(e) => setOperationalDate(e.target.value)}
                  className={inputClass}
                  required
                  disabled={!!existingOpenShift}
                />
              </div>

              <div>
                <label className={appLabelClass()}>
                  Código do órgão
                </label>
                <input
                  value={atsUnit?.code ?? ""}
                  className={inputClass}
                  disabled
                />
              </div>

              <div>
                <label className={appLabelClass()}>
                  Hora início UTC
                </label>
                <input
                  type="time"
                  value={startTime}
                  className={inputClass}
                  disabled
                />
              </div>

              <div className="md:col-span-2">
                <label className={appLabelClass()}>
                  Notas de abertura
                </label>
                <textarea
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  rows={4}
                  className={appTextareaClass()}
                  disabled={!!existingOpenShift}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={
              <SoftIcon tone="orange">
                <UsersIcon />
              </SoftIcon>
            }
            title="Composição do turno"
            subtitle="Esta lista é definida pelo supervisor e fica associada ao turno."
          >
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={addMember}
                disabled={!!existingOpenShift}
                className={appButtonClass("secondary", "xs")}
              >
                Adicionar membro
              </button>
            </div>

            <div className="space-y-4">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-3.5"
                >
                  <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                    <div>
                      <label className={appLabelClass()}>
                        Utilizador
                      </label>
                      <SelectField
                        value={member.user_id}
                        onChange={(e) =>
                          updateMember(index, "user_id", e.target.value)
                        }
                        disabled={!!existingOpenShift}
                      >
                        <option value="">Selecionar utilizador</option>
                        {unitUsers.map((unitUser) => (
                          <option key={unitUser.id} value={unitUser.id}>
                            {unitUser.full_name}
                          </option>
                        ))}
                      </SelectField>
                    </div>

                    <div>
                      <label className={appLabelClass()}>
                        Função no turno
                      </label>
                      <SelectField
                        value={member.role_in_shift}
                        onChange={(e) =>
                          updateMember(index, "role_in_shift", e.target.value)
                        }
                        disabled={!!existingOpenShift}
                      >
                        <option>Supervisor</option>
                        <option>CTA Operacional</option>
                        <option>CTA OJT</option>
                        <option>OJTI</option>
                        <option>CTA Assistente</option>
                        <option>AFIS</option>
                        <option>Outro</option>
                      </SelectField>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        disabled={!!existingOpenShift}
                        className={appButtonClass("danger", "xs")}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {!profile?.ats_unit_id && (
          <SectionCard
            icon={
              <SoftIcon tone="amber">
                <AlertIcon />
              </SoftIcon>
            }
            title="Perfil sem órgão ATS"
            subtitle="Este utilizador não tem unidade ATS associada."
          >
            <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              O perfil autenticado precisa de um órgão ATS associado antes de
              abrir turnos.
            </div>
          </SectionCard>
        )}

        <div className={appStickyBarClass()}>
          <div className="text-sm leading-6 text-slate-500">
            O supervisor inicia o turno, fixa a composição da equipa e gere os
            logs da posição operacional antes do registo de entradas.
          </div>

          <button
            type="submit"
            disabled={loading || !!existingOpenShift || !profile?.ats_unit_id}
            className={appButtonClass("primary", "xs")}
          >
            {loading ? "A iniciar..." : "Iniciar turno"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
