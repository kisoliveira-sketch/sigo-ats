"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import {
  AlertIcon,
  appButtonClass,
  appCheckboxClass,
  appFieldClass,
  appLabelClass,
  appTextareaClass,
  ClockIcon,
  EditIcon,
  FileIcon,
  heroActionClass,
  PageShell,
  SectionCard,
  SelectField,
  SlimStatCard,
  SoftIcon,
} from "@/components/siro-ui";

type ShiftRow = {
  id: number;
  shift_code: string;
  operational_date: string;
  status: string;
  validated_at_utc: string | null;
};

type CurrentProfile = {
  id: string;
  role: string;
};

type OccurrenceCategory = {
  id: number;
  name: string;
  code: string;
};

type OccurrenceRow = {
  id: number;
  occurrence_number: string;
  occurrence_at_utc: string;
  category_id: number | null;
  severity: string;
  description_factual: string;
  involved_entities: string | null;
  actions_taken: string | null;
  outcome: string | null;
  communications_made: string | null;
  documentary_reference: string | null;
  callsign: string | null;
  aircraft_registration: string | null;
  aircraft_type: string | null;
  equipment_reference: string | null;
  location_detail: string | null;
  weather_context: string | null;
  requires_followup: boolean;
  created_by: string | null;
};

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function canManageOccurrence(profile: CurrentProfile | null, createdBy: string | null) {
  if (!profile) return false;

  const elevatedRoles = new Set(["SUPERVISOR", "CHEFIA_ATS", "ADMIN"]);
  if (elevatedRoles.has(profile.role)) return true;

  return profile.id === createdBy;
}

export default function EditOccurrencePage() {
  const router = useRouter();
  const params = useParams();
  const shiftId = Array.isArray(params.shiftId)
    ? params.shiftId[0]
    : params.shiftId;
  const entryId = Array.isArray(params.entryId)
    ? params.entryId[0]
    : params.entryId;

  const [shift, setShift] = useState<ShiftRow | null>(null);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [categories, setCategories] = useState<OccurrenceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [occurrenceNumber, setOccurrenceNumber] = useState("—");
  const [occurrenceAtUtc, setOccurrenceAtUtc] = useState("");
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
  const [createdBy, setCreatedBy] = useState<string | null>(null);

  const canEdit = useMemo(
    () =>
      shift?.status === "OPEN" &&
      !shift?.validated_at_utc &&
      canManageOccurrence(currentProfile, createdBy),
    [createdBy, currentProfile, shift?.status, shift?.validated_at_utc],
  );

  useEffect(() => {
    if (!shiftId || !entryId) return;

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

      const [{ data: profileData, error: profileError }, { data: shiftData, error: shiftError }, { data: categoryData, error: categoryError }, { data: occurrenceData, error: occurrenceError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, role")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("shifts")
            .select("id, shift_code, operational_date, status, validated_at_utc")
            .eq("id", Number(shiftId))
            .maybeSingle(),
          supabase
            .from("occurrence_categories")
            .select("id, name, code")
            .order("name", { ascending: true }),
          supabase
            .from("occurrences")
            .select(
              `
              id,
              occurrence_number,
              occurrence_at_utc,
              category_id,
              severity,
              description_factual,
              involved_entities,
              actions_taken,
              outcome,
              communications_made,
              documentary_reference,
              callsign,
              aircraft_registration,
              aircraft_type,
              equipment_reference,
              location_detail,
              weather_context,
              requires_followup,
              created_by
            `,
            )
            .eq("id", Number(entryId))
            .eq("shift_id", Number(shiftId))
            .maybeSingle(),
        ]);

      if (!active) return;

      if (profileError || !profileData) {
        setMessage("Não foi possível validar o teu perfil.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      if (shiftError || !shiftData) {
        setMessage("Não foi possível carregar o turno desta entrada.");
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

      if (occurrenceError || !occurrenceData) {
        setMessage("Não foi possível carregar a entrada ATS.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      setCurrentProfile(profileData as CurrentProfile);
      setShift(shiftData as ShiftRow);
      setCategories((categoryData as OccurrenceCategory[]) ?? []);

      const occurrence = occurrenceData as OccurrenceRow;
      setCreatedBy(occurrence.created_by);
      setOccurrenceNumber(occurrence.occurrence_number);
      setOccurrenceAtUtc(toDateTimeLocalValue(occurrence.occurrence_at_utc));
      setCategoryId(occurrence.category_id ? String(occurrence.category_id) : "");
      setSeverity(occurrence.severity as (typeof SEVERITY_OPTIONS)[number]);
      setDescriptionFactual(occurrence.description_factual || "");
      setInvolvedEntities(occurrence.involved_entities || "");
      setActionsTaken(occurrence.actions_taken || "");
      setOutcome(occurrence.outcome || "");
      setCommunicationsMade(occurrence.communications_made || "");
      setDocumentaryReference(occurrence.documentary_reference || "");
      setCallsign(occurrence.callsign || "");
      setAircraftRegistration(occurrence.aircraft_registration || "");
      setAircraftType(occurrence.aircraft_type || "");
      setEquipmentReference(occurrence.equipment_reference || "");
      setLocationDetail(occurrence.location_detail || "");
      setWeatherContext(occurrence.weather_context || "");
      setRequiresFollowup(occurrence.requires_followup);
      setLoading(false);
    };

    void initPage();

    return () => {
      active = false;
    };
  }, [entryId, shiftId]);

  const inputClass = appFieldClass();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!shift) {
      setMessage("Turno não carregado.");
      setMessageType("error");
      return;
    }

    if (!canEdit) {
      setMessage(
        "Só podes alterar entradas que criaste, a menos que tenhas perfil de supervisão ou administração. Entradas de turnos fechados também ficam bloqueadas.",
      );
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
    setMessage("");
    setMessageType("");

    const occurrenceAtIso = new Date(`${occurrenceAtUtc}:00Z`).toISOString();

    const { error } = await supabase
      .from("occurrences")
      .update({
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
      })
      .eq("id", Number(entryId))
      .eq("shift_id", shift.id);

    if (error) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível atualizar a entrada",
          error.message,
        ),
      );
      setMessageType("error");
      setSaving(false);
      return;
    }

    window.sessionStorage.setItem(
      "siro-occurrence-success",
      "Entrada atualizada com sucesso.",
    );
    router.push(`/occurrences/${shift.id}`);
  };

  const handleDelete = async () => {
    if (!shift) {
      setMessage("Turno não carregado.");
      setMessageType("error");
      return;
    }

    if (!canEdit) {
      setMessage(
        "Só podes apagar entradas que criaste, a menos que tenhas perfil de supervisão ou administração. Entradas de turnos fechados também ficam bloqueadas.",
      );
      setMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      `Queres mesmo apagar a entrada ${occurrenceNumber}? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    setMessageType("");

    const { error } = await supabase
      .from("occurrences")
      .delete()
      .eq("id", Number(entryId))
      .eq("shift_id", shift.id);

    if (error) {
      setMessage(
        getFriendlyErrorMessage("Não foi possível apagar a entrada", error.message),
      );
      setMessageType("error");
      setDeleting(false);
      return;
    }

    window.sessionStorage.setItem(
      "siro-occurrence-success",
      "Entrada apagada com sucesso.",
    );
    router.push(`/occurrences/${shift.id}`);
  };

  return (
    <PageShell
      badge="Registo de Ocorrências ATS"
      title="Editar entrada"
      subtitle=""
      heroIcon={<EditIcon />}
      compact
      heroThin
      actions={
        <>
          <Link
            href={shift ? `/occurrences/${shift.id}` : "/occurrences"}
            className={appButtonClass("secondary", "sm")}
          >
            Voltar ao registo ATS
          </Link>

          <Link
            href="/occurrences"
            className={appButtonClass("secondary", "sm")}
          >
            Registos ATS
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
          subtitle="A preparar a edição da entrada."
        >
          <div className="text-sm text-slate-500">A carregar...</div>
        </SectionCard>
      ) : !shift ? (
        <SectionCard
          icon={
            <SoftIcon tone="amber">
              <AlertIcon />
            </SoftIcon>
          }
          title="Entrada indisponível"
          subtitle="Não foi possível abrir esta entrada para edição."
        >
          <Link
            href="/occurrences"
            className={heroActionClass("primary")}
          >
            Registos ATS
          </Link>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SlimStatCard
              icon={
                <SoftIcon tone="orange">
                  <FileIcon />
                </SoftIcon>
              }
              label="Turno"
              value={shift.shift_code}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="blue">
                  <ClockIcon />
                </SoftIcon>
              }
              label="Data operacional"
              value={shift.operational_date}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="emerald">
                  <EditIcon />
                </SoftIcon>
              }
              label="Referência da entrada"
              value={occurrenceNumber}
              noWrap
            />

            <SlimStatCard
              icon={
                <SoftIcon tone="slate">
                  <FileIcon />
                </SoftIcon>
              }
              label="Estado do turno"
              value={shift.status}
              noWrap
            />
          </section>

          {!canEdit && (
            <SectionCard
              icon={
                <SoftIcon tone="amber">
                  <AlertIcon />
                </SoftIcon>
              }
              title="Turno fechado"
              subtitle="Entradas de turnos fechados ou já validadas ficam bloqueadas para evitar alterações ao registo final."
            >
              <div className="text-sm text-slate-600">
                Esta entrada pode ser consultada, mas não pode ser alterada com o teu perfil atual, porque o turno já foi encerrado ou porque o registo ATS já foi validado.
              </div>
            </SectionCard>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              icon={
                <SoftIcon tone="blue">
                  <EditIcon />
                </SoftIcon>
              }
              title="Identificação"
              subtitle="Dados principais da entrada ATS."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Referência da entrada
                  </label>
                  <input value={occurrenceNumber} className={inputClass} disabled />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Data/Hora UTC
                  </label>
                  <input
                    type="datetime-local"
                    value={occurrenceAtUtc}
                    onChange={(e) => setOccurrenceAtUtc(e.target.value)}
                    className={inputClass}
                    required
                    disabled={!canEdit}
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
                    disabled={!canEdit}
                  >
                    <option value="">Selecionar categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.code} · {category.name}
                      </option>
                    ))}
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
                    disabled={!canEdit}
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
                    required
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={
                <SoftIcon tone="orange">
                  <FileIcon />
                </SoftIcon>
              }
              title="Contexto operacional"
              subtitle="Informação complementar associada à ocorrência."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={appLabelClass()}>
                    Callsign
                  </label>
                  <input
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    className={inputClass}
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
                  />
                </div>

                <label className="md:col-span-2 flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-slate-50/80 p-3.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={requiresFollowup}
                    onChange={(e) => setRequiresFollowup(e.target.checked)}
                    className={appCheckboxClass()}
                    disabled={!canEdit}
                  />
                  <span>
                    <span className="block font-medium text-slate-900">
                      Requer seguimento
                    </span>
                    <span className="mt-1 block text-slate-600">
                      Mantém esta opção ativa se a ocorrência continuar com seguimento pendente.
                    </span>
                  </span>
                </label>
              </div>
            </SectionCard>
          </div>

          <div className="sticky bottom-4 flex flex-col gap-3 rounded-[0.9rem] border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              {canEdit
                ? "Guarda as alterações para atualizar esta entrada no registo ATS."
                : "Este turno já foi encerrado, por isso a entrada fica apenas em consulta."}
            </div>

            <button
              type="submit"
              disabled={saving || deleting || !canEdit}
              className={appButtonClass("primary")}
            >
              {saving ? "A guardar..." : "Guardar alterações"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting || !canEdit}
              className={appButtonClass("danger")}
            >
              {deleting ? "A apagar..." : "Apagar entrada"}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
