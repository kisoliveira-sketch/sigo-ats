"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import {
  AlertIcon,
  appButtonClass,
  appCheckboxClass,
  appFieldClass,
  appLabelClass,
  appTextareaClass,
  appStickyBarClass,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  HashIcon,
  heroActionClass,
  InfoIcon,
  LoginIcon,
  PageShell,
  SectionCard,
  SelectField,
  SlimStatCard,
  SoftIcon,
  UserIcon,
} from "@/components/siro-ui";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  ats_unit_id: number | null;
};

type OpenShift = {
  id: number;
  shift_code: string;
  operational_date: string;
  status: string;
  validated_at_utc: string | null;
  opening_notes: string | null;
};

type OccurrenceCategory = {
  id: number;
  name: string;
  code: string;
};

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function getCurrentUtcDateTimeLocalValue() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getProfileDisplayName(profile: Profile | null) {
  if (!profile) return "—";

  const fullName = profile.full_name?.trim();
  return fullName || "—";
}

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

function isUserInShiftComposition(openingNotes: string | null, profile: Profile | null) {
  if (!profile) return false;

  const lines = extractCompositionLines(openingNotes);
  if (lines.length === 0) return false;

  const fullName = profile.full_name?.trim().toLowerCase();
  const email = profile.email.trim().toLowerCase();

  return lines.some((line) => {
    const member = line.split(":").slice(1).join(":").trim().toLowerCase();
    return (fullName && member === fullName) || member === email;
  });
}

export default function NewOccurrencePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [categories, setCategories] = useState<OccurrenceCategory[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [occurrenceAtUtc, setOccurrenceAtUtc] = useState(
    getCurrentUtcDateTimeLocalValue(),
  );
  const [categoryId, setCategoryId] = useState("");
  const [severity, setSeverity] =
    useState<(typeof SEVERITY_OPTIONS)[number]>("LOW");
  const [descriptionFactual, setDescriptionFactual] = useState("");
  const [involvedEntities, setInvolvedEntities] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [outcome, setOutcome] = useState("");
  const [communicationsMade, setCommunicationsMade] = useState("");
  const [documentaryReference, setDocumentaryReference] = useState("");
  const [callsign, setCallsign] = useState("");
  const [aircraftRegistration, setAircraftRegistration] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [equipmentReference, setEquipmentReference] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [weatherContext, setWeatherContext] = useState("");
  const [requiresFollowup, setRequiresFollowup] = useState(false);

  const occurrenceNumber = useMemo(() => {
    if (!openShift) return "—";
    return `${openShift.shift_code}-OCC-${String(existingCount + 1).padStart(3, "0")}`;
  }, [existingCount, openShift]);

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
        .select("id, email, full_name, role, ats_unit_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || !profileData) {
        setMessage("Não foi possível carregar o perfil.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      if (!profileData.ats_unit_id) {
        setMessage("Perfil sem órgão ATS associado.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      const [{ data: openShiftData, error: openShiftError }, { data: categoryData, error: categoryError }] =
        await Promise.all([
          supabase
            .from("shifts")
            .select("id, shift_code, operational_date, status, validated_at_utc, opening_notes")
            .eq("ats_unit_id", profileData.ats_unit_id)
            .eq("status", "OPEN")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("occurrence_categories")
            .select("id, name, code")
            .order("name", { ascending: true }),
        ]);

      if (!active) return;

      if (openShiftError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível verificar se existe um turno aberto",
            openShiftError.message,
          ),
        );
        setMessageType("error");
        setLoading(false);
        return;
      }

      if (categoryError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar as categorias da ocorrência",
            categoryError.message,
          ),
        );
        setMessageType("error");
        setLoading(false);
        return;
      }

      setOpenShift((openShiftData as OpenShift | null) ?? null);
      setCategories((categoryData as OccurrenceCategory[]) ?? []);

      const initialCategories = (categoryData as OccurrenceCategory[]) ?? [];
      if (initialCategories.length > 0) {
        setCategoryId(String(initialCategories[0].id));
      }

      if (!openShiftData) {
        setLoading(false);
        return;
      }

      const { count, error: countError } = await supabase
        .from("occurrences")
        .select("id", { count: "exact", head: true })
        .eq("shift_id", openShiftData.id);

      if (!active) return;

      if (countError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível preparar a referência da nova entrada",
            countError.message,
          ),
        );
        setMessageType("error");
        setLoading(false);
        return;
      }

      setExistingCount(count ?? 0);
      setLoading(false);
    };

    void initPage();

    return () => {
      active = false;
    };
  }, []);

  const inputClass = appFieldClass();
  const canCreateOccurrence =
    !!openShift && !!profile && isUserInShiftComposition(openShift.opening_notes, profile);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!profile) {
      setMessage("Perfil não carregado.");
      setMessageType("error");
      return;
    }

    if (!openShift) {
      setMessage("Não existe turno aberto para registar uma nova entrada.");
      setMessageType("error");
      return;
    }

    if (!canCreateOccurrence) {
      setMessage("Só os CTA que fazem parte da composição do turno podem registar novas entradas.");
      setMessageType("error");
      return;
    }

    if (openShift.validated_at_utc) {
      setMessage("Este turno já foi validado. Não é possível registar novas entradas.");
      setMessageType("error");
      return;
    }

    if (!categoryId) {
      setMessage("Seleciona uma categoria.");
      setMessageType("error");
      return;
    }

    if (!descriptionFactual.trim()) {
      setMessage("A descrição factual é obrigatória.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    setRedirecting(false);
    setMessage("");
    setMessageType("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Utilizador não autenticado.");
      setMessageType("error");
      setSaving(false);
      return;
    }

    const occurrenceAtIso = new Date(`${occurrenceAtUtc}:00Z`).toISOString();

    const { data, error } = await supabase
      .from("occurrences")
      .insert({
        ats_unit_id: profile.ats_unit_id,
        shift_id: openShift.id,
        occurrence_number: occurrenceNumber,
        occurrence_at_utc: occurrenceAtIso,
        category_id: Number(categoryId),
        severity,
        description_factual: descriptionFactual.trim(),
        involved_entities: normalizeText(involvedEntities),
        actions_taken: normalizeText(actionsTaken),
        outcome: normalizeText(outcome),
        communications_made: normalizeText(communicationsMade),
        documentary_reference: normalizeText(documentaryReference),
        callsign: normalizeText(callsign),
        aircraft_registration: normalizeText(aircraftRegistration),
        aircraft_type: normalizeText(aircraftType),
        equipment_reference: normalizeText(equipmentReference),
        location_detail: normalizeText(locationDetail),
        weather_context: normalizeText(weatherContext),
        requires_followup: requiresFollowup,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível guardar a entrada",
          error?.message,
        ),
      );
      setMessageType("error");
      setSaving(false);
      return;
    }

    setMessage("Entrada registada com sucesso. A abrir o registo ATS...");
    setMessageType("success");
    setExistingCount((current) => current + 1);
    setSaving(false);
    setRedirecting(true);
    window.sessionStorage.setItem(
      "siro-occurrence-success",
      "Entrada registada com sucesso.",
    );

    setTimeout(() => {
      router.push(`/occurrences/${openShift.id}`);
    }, 1600);
  };

  return (
    <PageShell
      badge="Registo de Ocorrências ATS - Nova entrada"
      title="Registo de Ocorrências ATS - Nova entrada"
      subtitle=""
      heroIcon={<EditIcon />}
      compact
      heroThin
      actions={
        <>
          <Link
            href="/occurrences"
            className={heroActionClass()}
          >
            Registos ATS
          </Link>

          <Link
            href="/"
            className={heroActionClass()}
          >
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
          subtitle="A preparar o formulário de registo."
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
          subtitle="É necessário existir um turno ativo para registar entradas."
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shifts/open"
              className={heroActionClass("primary")}
            >
              Abrir turno
            </Link>

            <Link
              href="/"
              className={heroActionClass()}
            >
              Painel principal
            </Link>
          </div>
        </SectionCard>
      ) : !canCreateOccurrence ? (
        <SectionCard
          icon={
            <SoftIcon tone="amber">
              <AlertIcon />
            </SoftIcon>
          }
          title="Registo restrito"
          subtitle="Só os CTA que fazem parte da composição do turno podem registar novas entradas ATS."
        >
          <div className="flex flex-wrap gap-3">
            <Link href="/occurrences" className={heroActionClass()}>
              Registos ATS
            </Link>

            <Link href="/" className={heroActionClass()}>
              Painel principal
            </Link>
          </div>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {openShift.validated_at_utc && (
            <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Este turno já foi validado. Depois da validação final, não é possível registar novas entradas.
            </div>
          )}
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SlimStatCard
              icon={
                <SoftIcon tone="orange">
                  <LoginIcon />
                </SoftIcon>
              }
              label="Turno aberto"
              value={<span className="text-xs font-bold">{openShift.shift_code}</span>}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="blue">
                  <CalendarIcon />
                </SoftIcon>
              }
              label="Data operacional"
              value={openShift.operational_date}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="emerald">
                  <UserIcon />
                </SoftIcon>
              }
              label="Autor"
              value={getProfileDisplayName(profile)}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="slate">
                  <HashIcon />
                </SoftIcon>
              }
              label="Referência da entrada"
              value={<span className="text-xs font-bold">{occurrenceNumber}</span>}
              noWrap
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              icon={
                <SoftIcon tone="blue">
                  <HashIcon />
                </SoftIcon>
              }
              title="Identificação"
              subtitle="Dados principais da ocorrência a registar."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={appLabelClass()}>
                    Referência da entrada
                  </label>
                  <input value={occurrenceNumber} className={inputClass} disabled />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Data/Hora UTC
                  </label>
                  <input
                    type="datetime-local"
                    value={occurrenceAtUtc}
                    onChange={(e) => setOccurrenceAtUtc(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Categoria
                  </label>
                  <SelectField
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    {categories.length === 0 ? (
                      <option value="">Sem categorias disponíveis</option>
                    ) : (
                      categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    )}
                  </SelectField>
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Gravidade
                  </label>
                  <SelectField
                    value={severity}
                    onChange={(e) =>
                      setSeverity(e.target.value as (typeof SEVERITY_OPTIONS)[number])
                    }
                    required
                  >
                    {SEVERITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div className="md:col-span-2">
                  <label className={appLabelClass()}>
                    Descrição factual
                  </label>
                  <textarea
                    value={descriptionFactual}
                    onChange={(e) => setDescriptionFactual(e.target.value)}
                    rows={6}
                    className={appTextareaClass()}
                    placeholder="Descreve objetivamente o que aconteceu, em sequência temporal e com o máximo de clareza operacional."
                    required
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={
                <SoftIcon tone="orange">
                  <InfoIcon />
                </SoftIcon>
              }
              title="Contexto operacional"
              subtitle="Informação complementar para análise, seguimento e auditoria."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={appLabelClass()}>
                    Callsign
                  </label>
                  <input
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Matrícula
                  </label>
                  <input
                    value={aircraftRegistration}
                    onChange={(e) => setAircraftRegistration(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Tipo de aeronave
                  </label>
                  <input
                    value={aircraftType}
                    onChange={(e) => setAircraftType(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Local / detalhe
                  </label>
                  <input
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Equipamento
                  </label>
                  <input
                    value={equipmentReference}
                    onChange={(e) => setEquipmentReference(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={appLabelClass()}>
                    Meteorologia
                  </label>
                  <input
                    value={weatherContext}
                    onChange={(e) => setWeatherContext(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={appLabelClass()}>
                    Envolvidos
                  </label>
                  <textarea
                    value={involvedEntities}
                    onChange={(e) => setInvolvedEntities(e.target.value)}
                    rows={3}
                    className={appTextareaClass()}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={appLabelClass()}>
                    Ações tomadas
                  </label>
                  <textarea
                    value={actionsTaken}
                    onChange={(e) => setActionsTaken(e.target.value)}
                    rows={3}
                    className={appTextareaClass()}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={appLabelClass()}>
                    Resultado / consequência
                  </label>
                  <textarea
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    rows={3}
                    className={appTextareaClass()}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={appLabelClass()}>
                    Comunicações efetuadas
                  </label>
                  <textarea
                    value={communicationsMade}
                    onChange={(e) => setCommunicationsMade(e.target.value)}
                    rows={3}
                    className={appTextareaClass()}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={appLabelClass()}>
                    Referência documental
                  </label>
                  <input
                    value={documentaryReference}
                    onChange={(e) => setDocumentaryReference(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <label className="md:col-span-2 flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-slate-50/80 p-3.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={requiresFollowup}
                    onChange={(e) => setRequiresFollowup(e.target.checked)}
                    className={appCheckboxClass()}
                  />
                  <span>
                    <span className="block font-medium text-slate-900">
                      Requer seguimento
                    </span>
                    <span className="mt-1 block text-slate-600">
                      Assinala esta opção se a ocorrência exigir seguimento pendente,
                      monitorização adicional ou handover específico.
                    </span>
                  </span>
                </label>
              </div>
            </SectionCard>
          </div>

          <div className={appStickyBarClass()}>
            <div className="text-sm leading-6 text-slate-500">
              A nova entrada será associada ao turno{" "}
              <span className="font-medium text-slate-700">
                {openShift.shift_code}
              </span>{" "}
              e ao utilizador autenticado.
            </div>

            <button
              type="submit"
              disabled={saving || redirecting || categories.length === 0 || !!openShift.validated_at_utc}
              className={appButtonClass("primary")}
            >
              {saving
                ? "A guardar..."
                : redirecting
                  ? "A redirecionar..."
                  : "Guardar entrada"}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
