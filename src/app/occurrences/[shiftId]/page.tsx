"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { exportShiftReportPdf } from "@/lib/export-shift-report-pdf";
import {
  appCheckboxClass,
  appFieldClass,
  appButtonClass,
  appIconButtonClass,
  FileIcon,
  heroActionClass,
} from "@/components/siro-ui";

type ShiftDetail = {
  id: number;
  shift_code: string;
  operational_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  status: string;
  opened_by: string | null;
  validated_by: string | null;
  validated_at_utc: string | null;
  opening_notes: string | null;
  handover_notes: string | null;
};

type CurrentProfile = {
  id: string;
  role: string;
  full_name: string | null;
};

type EntryRow = {
  id: number;
  occurrence_number: string;
  severity: string;
  occurrence_at_utc: string;
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
  occurrence_categories: {
    name: string;
    code: string;
  } | null;
};

type AuthorProfile = {
  id: string;
  full_name: string | null;
  email: string;
};

type PositionLogRow = {
  id: number;
  user_id: string;
  entered_at_utc: string;
  left_at_utc: string | null;
  notes: string | null;
};

function getValidationTimestampIso() {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 1);
  return now.toISOString();
}

function canManageOccurrence(profile: CurrentProfile | null, createdBy: string | null) {
  if (!profile) return false;

  const elevatedRoles = new Set(["SUPERVISOR", "CHEFIA_ATS", "ADMIN"]);
  if (elevatedRoles.has(profile.role)) return true;

  return profile.id === createdBy;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M6 9V4h12v5" />
      <rect x="6" y="14" width="12" height="6" rx="1" />
      <path d="M6 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
    </svg>
  );
}

function CsvIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v6h6" />
      <path d="M9 17h1.5a1.5 1.5 0 0 0 0-3H9v5" />
      <path d="M14 19v-5h1.2a1.8 1.8 0 0 1 0 3.6H14" />
      <path d="M18 14h-2v5" />
    </svg>
  );
}

const topActionButtonClass =
  "inline-flex items-center justify-center rounded-[0.72rem] border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-[#1d4f91] hover:bg-[#1d4f91] hover:text-white hover:shadow-[0_16px_28px_-18px_rgba(29,79,145,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a67ba]/35";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function formatUtcTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes} UTC`;
}

function formatText(value: string | null) {
  return value?.trim() || "—";
}

function SearchField({
  search,
  setSearch,
  searchOpen,
  setSearchOpen,
}: {
  search: string;
  setSearch: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  return (
    <div className="no-print mb-5 flex flex-col gap-3 rounded-[0.95rem] border border-slate-200 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-slate-500">
        Pesquisa interna nas entradas deste registo.
      </div>

      <div className="flex items-center gap-2">
        {searchOpen && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-72 ${appFieldClass()}`}
            placeholder="Pesquisar nas entradas..."
          />
        )}

        <button
          type="button"
          onClick={() => {
            if (searchOpen && search) setSearch("");
            setSearchOpen((prev) => !prev);
          }}
          className={appIconButtonClass()}
          aria-label="Pesquisar nas entradas"
          title="Pesquisar nas entradas"
        >
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}

function ReportRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 md:grid-cols-[170px_1fr]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="text-sm leading-6 text-slate-900">{value}</div>
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.1rem] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)]">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EntrySubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-[0.8rem] border border-slate-200/80 bg-slate-50/60 px-3.5 py-3">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h4>
      <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
        {children}
      </div>
    </div>
  );
}

export default function ShiftRecordDetailPage() {
  const params = useParams();
  const shiftId = Array.isArray(params.shiftId)
    ? params.shiftId[0]
    : params.shiftId;

  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [positionLogs, setPositionLogs] = useState<PositionLogRow[]>([]);
  const [authorsMap, setAuthorsMap] = useState<Record<string, string>>({});
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [openedByName, setOpenedByName] = useState("—");
  const [validatedByName, setValidatedByName] = useState("—");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [validating, setValidating] = useState(false);
  const [showValidatePrompt, setShowValidatePrompt] = useState(false);
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [successMessage] = useState(() => {
    if (typeof window === "undefined") return "";

    const flashMessage = window.sessionStorage.getItem(
      "siro-occurrence-success",
    );

    if (flashMessage) {
      window.sessionStorage.removeItem("siro-occurrence-success");
    }

    return flashMessage || "";
  });
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);

  useEffect(() => {
    if (!shiftId) return;

    let active = true;

    const initPage = async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setMessage("Sessão não encontrada.");
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || !profileData) {
        setMessage("Não foi possível validar o teu perfil.");
        setLoading(false);
        return;
      }

      setCurrentProfile(profileData as CurrentProfile);

      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .select(
          `
          id,
          shift_code,
          operational_date,
          start_time_utc,
          end_time_utc,
          status,
          opened_by,
          validated_by,
          validated_at_utc,
          opening_notes,
          handover_notes
        `,
        )
        .eq("id", Number(shiftId))
        .maybeSingle();

      if (!active) return;

      if (shiftError || !shiftData) {
        setMessage("Não foi possível carregar o registo ATS.");
        setLoading(false);
        return;
      }

      setShift(shiftData as ShiftDetail);

      const { data: entriesData, error: entriesError } = await supabase
        .from("occurrences")
        .select(
          `
          id,
          occurrence_number,
          severity,
          occurrence_at_utc,
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
          created_by,
          occurrence_categories:category_id (
            name,
            code
          )
        `,
        )
        .eq("shift_id", Number(shiftId))
        .order("occurrence_at_utc", { ascending: true });

      if (!active) return;

      if (entriesError) {
        setMessage(`Erro ao carregar entradas: ${entriesError.message}`);
        setLoading(false);
        return;
      }

      const loadedEntries = (entriesData as EntryRow[]) || [];
      setEntries(loadedEntries);

      const { data: positionLogsData, error: positionLogsError } = await supabase
        .from("shift_position_logs")
        .select("id, user_id, entered_at_utc, left_at_utc, notes")
        .eq("shift_id", Number(shiftId))
        .order("entered_at_utc", { ascending: true });

      if (!active) return;

      if (positionLogsError) {
        setMessage(`Erro ao carregar logs operacionais: ${positionLogsError.message}`);
        setLoading(false);
        return;
      }

      const loadedPositionLogs = (positionLogsData as PositionLogRow[]) || [];
      setPositionLogs(loadedPositionLogs);

      const authorIds = Array.from(
        new Set(
          [
            ...loadedEntries.map((entry) => entry.created_by),
            ...loadedPositionLogs.map((item) => item.user_id),
            shiftData.opened_by,
            shiftData.validated_by,
          ].filter((value): value is string => Boolean(value)),
        ),
      );

      if (authorIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", authorIds);

        if (!active) return;

        if (!profilesError && profilesData) {
          const mapped = (profilesData as AuthorProfile[]).reduce<
            Record<string, string>
          >((acc, profile) => {
            acc[profile.id] = profile.full_name || profile.email;
            return acc;
          }, {});
          setAuthorsMap(mapped);
          setOpenedByName(
            shiftData.opened_by ? mapped[shiftData.opened_by] || "—" : "—",
          );
          setValidatedByName(
            shiftData.validated_by ? mapped[shiftData.validated_by] || "—" : "—",
          );
        } else {
          setAuthorsMap({});
          setOpenedByName("—");
          setValidatedByName("—");
        }
      } else {
        setAuthorsMap({});
        setOpenedByName("—");
        setValidatedByName("—");
      }

      setLoading(false);
    };

    void initPage();

    return () => {
      active = false;
    };
  }, [shiftId]);

  const extractComposition = (openingNotes: string | null) => {
    if (!openingNotes) {
      return {
        compositionLines: [] as string[],
        notes: "—",
        supervisor: "—",
      };
    }

    const marker = "Composição do turno:";
    const idx = openingNotes.indexOf(marker);

    if (idx === -1) {
      return {
        compositionLines: [],
        notes: openingNotes.trim() || "—",
        supervisor: "—",
      };
    }

    const before = openingNotes.slice(0, idx).trim();
    const after = openingNotes.slice(idx + marker.length).trim();

    const compositionLines = after
      ? after
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const supervisorLine =
      compositionLines.find((item) =>
        item.toLowerCase().startsWith("supervisor:"),
      ) || "";

    const supervisor = supervisorLine
      ? supervisorLine.split(":").slice(1).join(":").trim() || "—"
      : "—";

    return {
      compositionLines,
      notes: before || "—",
      supervisor,
    };
  };

  const { compositionLines, notes, supervisor } = useMemo(
    () => extractComposition(shift?.opening_notes ?? null),
    [shift?.opening_notes],
  );

  const weatherSummary = useMemo(() => {
    const values = Array.from(
      new Set(
        entries
          .map((entry) => entry.weather_context?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );
    return values.length ? values.join("\n\n") : "—";
  }, [entries]);

  const equipmentSummary = useMemo(() => {
    const values = Array.from(
      new Set(
        entries
          .map((entry) => entry.equipment_reference?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );
    return values.length ? values.join("\n") : "—";
  }, [entries]);

  const occurrenceLevelSummary = useMemo(() => {
    if (!entries.length) return "—";
    const severityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const highest = entries.reduce((acc, entry) => {
      return severityOrder.indexOf(entry.severity) > severityOrder.indexOf(acc)
        ? entry.severity
        : acc;
    }, "LOW");
    return highest;
  }, [entries]);

  const pendingFollowupCount = useMemo(
    () => entries.filter((entry) => entry.requires_followup).length,
    [entries],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!search) return true;
      const q = search.toLowerCase();

      return (
        entry.occurrence_number?.toLowerCase().includes(q) ||
        entry.description_factual?.toLowerCase().includes(q) ||
        entry.callsign?.toLowerCase().includes(q) ||
        entry.location_detail?.toLowerCase().includes(q) ||
        entry.occurrence_categories?.name?.toLowerCase().includes(q) ||
        authorsMap[entry.created_by || ""]?.toLowerCase().includes(q)
      );
    });
  }, [entries, search, authorsMap]);

  const activeEntry = useMemo(() => {
    if (filteredEntries.length === 0) return null;

    return (
      filteredEntries.find((entry) => entry.id === activeEntryId) ??
      filteredEntries[0]
    );
  }, [filteredEntries, activeEntryId]);

  const getAuthorLabel = (createdBy: string | null) => {
    if (!createdBy) return "Autor não identificado";
    return authorsMap[createdBy] || "Utilizador do sistema";
  };

  const canValidateShift =
    !!shift &&
    shift.status === "OPEN" &&
    entries.length > 0 &&
    !shift.validated_at_utc &&
    !!currentProfile &&
    shift.opened_by === currentProfile.id;

  const handleValidateShift = async () => {
    if (!shift) {
      setMessage("Registo ATS não carregado.");
      return;
    }

    if (shift.status !== "OPEN") {
      setMessage("A validação deve ser efetuada durante o turno aberto.");
      return;
    }

    if (shift.validated_at_utc) {
      setMessage("Este registo ATS já se encontra validado.");
      return;
    }

    if (!currentProfile || shift.opened_by !== currentProfile.id) {
      setMessage(
        `Só o utilizador ${openedByName} que abriu o turno pode efetuar a validação final.`,
      );
      return;
    }

    setConfirmValidate(false);
    setShowValidatePrompt(true);
  };

  const confirmValidateShift = async () => {
    if (!shift || !currentProfile || !confirmValidate) return;

    setValidating(true);
    setMessage("");
    setShowValidatePrompt(false);

    const validatedAtIso = getValidationTimestampIso();

    const { error } = await supabase
      .from("shifts")
      .update({
        validated_by: currentProfile.id,
        validated_at_utc: validatedAtIso,
      })
      .eq("id", shift.id);

    if (error) {
      setMessage(`Não foi possível validar o registo ATS: ${error.message}`);
      setValidating(false);
      return;
    }

    setShift({
      ...shift,
      validated_by: currentProfile.id,
      validated_at_utc: validatedAtIso,
    });
    setValidatedByName(currentProfile.full_name || openedByName);
    setConfirmValidate(false);
    setValidating(false);
  };

  const csvEscape = (value: unknown) => {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportCsv = () => {
    if (!shift) return;

    const header = [
      "shift_code",
      "operational_date",
      "status",
      "supervisor",
      "entry_number",
      "entry_datetime_utc",
      "category",
      "severity",
      "requires_followup",
      "author",
      "callsign",
      "aircraft_registration",
      "aircraft_type",
      "location_detail",
      "equipment_reference",
      "weather_context",
      "description_factual",
      "involved_entities",
      "actions_taken",
      "outcome",
      "communications_made",
      "documentary_reference",
    ];

    const rows = entries.map((entry) => [
      shift.shift_code,
      shift.operational_date,
      shift.status,
      supervisor,
      entry.occurrence_number,
      formatUtcDateTime(entry.occurrence_at_utc),
      entry.occurrence_categories?.name ?? "",
      entry.severity,
      entry.requires_followup ? "YES" : "NO",
      getAuthorLabel(entry.created_by),
      entry.callsign ?? "",
      entry.aircraft_registration ?? "",
      entry.aircraft_type ?? "",
      entry.location_detail ?? "",
      entry.equipment_reference ?? "",
      entry.weather_context ?? "",
      entry.description_factual ?? "",
      entry.involved_entities ?? "",
      entry.actions_taken ?? "",
      entry.outcome ?? "",
      entry.communications_made ?? "",
      entry.documentary_reference ?? "",
    ]);

    const csvContent = [
      header.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${shift.shift_code}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    if (!shift) return;

    exportShiftReportPdf({
      shift,
      entries,
      supervisor,
      composition: compositionLines.length ? compositionLines.join("\n") : "—",
      notes,
      weatherSummary,
      equipmentSummary,
      occurrenceLevelSummary,
      pendingFollowupCount,
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-sm text-slate-500">
            A carregar registo ATS...
          </div>
        </div>
      </main>
    );
  }

  if (!shift) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-4 text-sm text-red-700">
            {message || "Registo ATS não encontrado."}
          </div>
          <Link
            href="/occurrences"
            className={appButtonClass("secondary", "sm")}
          >
            Voltar aos Registos ATS
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="no-print mb-4 overflow-hidden rounded-[1.05rem] border border-slate-200/80 bg-white/96 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.22)] ring-1 ring-white/80">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <Link href="/" className="inline-flex">
                <Image
                  src="https://dtqajfxkhfarwqzuuepn.supabase.co/storage/v1/object/sign/occurrences-docs/logo_SIGO.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iZjJmYzNkZS1kZDQzLTQ5NGYtYjk1MS03NTcyMGZkYmVhYzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJvY2N1cnJlbmNlcy1kb2NzL2xvZ29fU0lHTy5wbmciLCJpYXQiOjE3NzczNjczNTYsImV4cCI6NDkzMDk2NzM1Nn0.o7Ti1qZ4mFm5pyiotc_Es9F7Gkeqp3dIOFs8BizkCb4"
                  alt="SIRO-ATS"
                  width={2048}
                  height={398}
                  className="h-11 w-auto object-contain sm:h-12"
                />
              </Link>
            </div>

            <div className="relative z-10 flex flex-wrap gap-2">
              <Link href="/occurrences" className={heroActionClass()}>
                Registos ATS
              </Link>

              <Link href="/" className={heroActionClass()}>
                Painel principal
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-3">
            <div className="inline-flex items-center gap-3 text-[#1d4f91]">
              <span className="flex h-9 w-9 items-center justify-center rounded-[0.8rem] bg-[#eef4fb]">
                <FileIcon />
              </span>
              <div>
                <h1 className="text-[15px] font-semibold">
                  Registo de Ocorrências ATS - Registo consolidado
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="no-print mb-6 flex flex-wrap justify-start gap-2 border-b border-slate-200/80 pb-4">
          <button
            type="button"
            onClick={handleExportCsv}
            className={`${topActionButtonClass} gap-2`}
          >
            <CsvIcon />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className={`${topActionButtonClass} gap-2`}
          >
            <PdfIcon />
            Exportar PDF
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className={`${topActionButtonClass} gap-2`}
          >
            <PrintIcon />
            Imprimir
          </button>
        </div>

        {successMessage && (
          <div className="no-print mb-4 rounded-[0.9rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {message && <div className="no-print mb-4 text-sm text-red-700">{message}</div>}

        <article className="print-area space-y-6">
          <ReportSection title="Identificação do turno">
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Referência do turno
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {shift.shift_code}
                  </div>
                </div>
                <div className="rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Supervisor
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {supervisor}
                  </div>
                </div>
                <div className="rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Data operacional
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {shift.operational_date}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Estado
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {shift.status}
                  </div>
                </div>
                <div className="rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Início UTC
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {formatDateTime(shift.start_time_utc)}
                  </div>
                </div>
                <div className="rounded-[0.8rem] border border-slate-200/80 bg-slate-50/70 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Fim UTC
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {formatDateTime(shift.end_time_utc)}
                  </div>
                </div>
              </div>
            </div>
          </ReportSection>

          <ReportSection title="Síntese operacional">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[0.9rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(248,250,252,0.92)_0%,_rgba(255,255,255,0.96)_100%)] px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Número de entradas
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {entries.length}
                </div>
              </div>
              <div className="rounded-[0.9rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(248,250,252,0.92)_0%,_rgba(255,255,255,0.96)_100%)] px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Nível mais elevado
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {occurrenceLevelSummary}
                </div>
              </div>
              <div className="rounded-[0.9rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(248,250,252,0.92)_0%,_rgba(255,255,255,0.96)_100%)] px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Seguimento pendente
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {pendingFollowupCount}
                </div>
              </div>
            </div>
          </ReportSection>

          <ReportSection title="Composição do turno">
            {compositionLines.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {compositionLines.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm leading-6 text-slate-900"
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm leading-6 text-slate-900">
                —
              </div>
            )}
          </ReportSection>

          <ReportSection title="Logs operacionais da posição">
            {positionLogs.length ? (
              <div className="grid gap-3">
                {positionLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3"
                  >
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Registo
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-slate-900">
                          {index + 1}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          CTA
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-slate-900">
                          {authorsMap[log.user_id] || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Entrada
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-slate-900">
                          {formatUtcDateTime(log.entered_at_utc)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Saída
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-slate-900">
                          {formatUtcDateTime(log.left_at_utc)}
                        </div>
                      </div>
                    </div>
                    {log.notes ? (
                      <div className="mt-3 text-sm text-slate-600">
                        Nota: {log.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm leading-6 text-slate-900">
                —
              </div>
            )}
          </ReportSection>

          <div className="grid gap-6 md:grid-cols-2">
            <ReportSection title="Notas de abertura">
              <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 whitespace-pre-wrap text-sm leading-6 text-slate-900">
                {notes}
              </div>
            </ReportSection>

            <ReportSection title="Notas de fecho">
              <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 whitespace-pre-wrap text-sm leading-6 text-slate-900">
                {formatText(shift.handover_notes)}
              </div>
            </ReportSection>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <ReportSection title="Condições meteorológicas reportadas">
              <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 whitespace-pre-wrap text-sm leading-6 text-slate-900">
                {weatherSummary}
              </div>
            </ReportSection>

            <ReportSection title="Condições / referências de equipamentos">
              <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50/70 px-3.5 py-3 whitespace-pre-wrap text-sm leading-6 text-slate-900">
                {equipmentSummary}
              </div>
            </ReportSection>
          </div>

          <ReportSection title="Entradas ATS">
            <SearchField
              search={search}
              setSearch={setSearch}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
            />

            {filteredEntries.length === 0 ? (
              <div className="text-sm text-slate-500">
                Não existem entradas para mostrar com o filtro atual.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.15rem] border border-slate-200 bg-[linear-gradient(180deg,_rgba(241,245,249,0.96)_0%,_rgba(226,232,240,0.9)_100%)] px-4 pb-4 pt-6 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.2)]">
                  <div className="no-print mb-0 flex flex-wrap items-end gap-2 px-1">
                    {filteredEntries.map((entry, index) => {
                      const isActive = entry.id === activeEntry?.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setActiveEntryId(entry.id)}
                          className={`inline-flex items-center justify-center rounded-t-[0.75rem] border px-4 py-2.5 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                            isActive
                              ? "relative z-20 -mb-px border-slate-200 border-b-white bg-white shadow-[0_-8px_18px_-16px_rgba(15,23,42,0.16)]"
                              : "relative z-10 border-slate-300/90 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_rgba(241,245,249,0.98)_100%)] hover:bg-white"
                          }`}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {`Entrada ${index + 1}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeEntry && (
                    <section className="relative z-10 -mt-px rounded-[0_1.1rem_1.1rem_1.1rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.96)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_36px_-30px_rgba(15,23,42,0.18)]">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                          <h3 className="text-sm font-semibold tracking-tight text-slate-950 md:text-base">
                            {activeEntry.occurrence_number}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {activeEntry.occurrence_categories?.name ?? "Categoria não indicada"} ·{" "}
                            {activeEntry.severity}
                          </p>
                          {shift.status === "OPEN" &&
                            !shift.validated_at_utc &&
                            canManageOccurrence(currentProfile, activeEntry.created_by) && (
                              <Link
                                href={`/occurrences/${shift.id}/entries/${activeEntry.id}/edit`}
                                className={`no-print mt-2 ${appButtonClass("secondary", "sm")}`}
                              >
                                Editar entrada
                              </Link>
                            )}
                        </div>
                        <div className="rounded-[0.8rem] border border-slate-200 bg-white px-3 py-2 text-right shadow-[0_12px_24px_-24px_rgba(15,23,42,0.18)]">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Hora de registo
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {formatUtcTime(activeEntry.occurrence_at_utc)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-3">
                          <ReportRow
                            label="Categoria"
                            value={activeEntry.occurrence_categories?.name ?? "—"}
                          />
                          <ReportRow label="Gravidade" value={activeEntry.severity} />
                          <ReportRow
                            label="Seguimento"
                            value={activeEntry.requires_followup ? "Sim" : "Não"}
                          />
                          <ReportRow
                            label="Autor"
                            value={getAuthorLabel(activeEntry.created_by)}
                          />
                          <ReportRow
                            label="Callsign"
                            value={formatText(activeEntry.callsign)}
                          />
                        </div>
                        <div className="space-y-3">
                          <ReportRow
                            label="Matrícula"
                            value={formatText(activeEntry.aircraft_registration)}
                          />
                          <ReportRow
                            label="Tipo de aeronave"
                            value={formatText(activeEntry.aircraft_type)}
                          />
                          <ReportRow
                            label="Local / detalhe"
                            value={formatText(activeEntry.location_detail)}
                          />
                          <ReportRow
                            label="Equipamento"
                            value={formatText(activeEntry.equipment_reference)}
                          />
                          <ReportRow
                            label="Meteorologia"
                            value={formatText(activeEntry.weather_context)}
                          />
                        </div>
                      </div>

                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <div>
                          <EntrySubsection title="Descrição factual">
                            {formatText(activeEntry.description_factual)}
                          </EntrySubsection>

                          <EntrySubsection title="Envolvidos">
                            {formatText(activeEntry.involved_entities)}
                          </EntrySubsection>

                          <EntrySubsection title="Ações tomadas">
                            {formatText(activeEntry.actions_taken)}
                          </EntrySubsection>
                        </div>

                        <div>
                          <EntrySubsection title="Resultado / consequência">
                            {formatText(activeEntry.outcome)}
                          </EntrySubsection>

                          <EntrySubsection title="Comunicações efetuadas">
                            {formatText(activeEntry.communications_made)}
                          </EntrySubsection>

                          <EntrySubsection title="Referência documental">
                            {formatText(activeEntry.documentary_reference)}
                          </EntrySubsection>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}
          </ReportSection>

          <section className="rounded-[1.45rem] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)]">
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-800">
              Validação
            </h2>

            <div className="grid gap-12 md:grid-cols-2">
              <div>
                <div className="flex h-10 items-end border-b border-slate-400 pb-1 text-sm font-medium text-slate-900">
                  {shift.validated_at_utc ? validatedByName : "—"}
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  Supervisor / responsável
                </div>
              </div>
              <div>
                <div className="flex h-10 items-end border-b border-slate-400 pb-1 text-sm font-medium text-slate-900">
                  {shift.validated_at_utc
                    ? formatUtcDateTime(shift.validated_at_utc)
                    : "—"}
                </div>
                <div className="mt-2 text-sm text-slate-700">Data</div>
              </div>
            </div>

            <div className="no-print mt-5 flex flex-wrap items-center gap-3">
              {canValidateShift ? (
                <>
                  <button
                    type="button"
                    onClick={handleValidateShift}
                    disabled={validating}
                    className={appButtonClass("primary", "sm")}
                  >
                    {validating ? "A validar..." : "Validar registo ATS"}
                  </button>

                  {showValidatePrompt && (
                    <div className="w-full rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      <p className="leading-6">
                        Queres validar este registo ATS? Depois da validação final, não deverá haver mais correções a efetuar.
                      </p>

                      <label className="mt-4 flex items-start gap-3 rounded-[0.9rem] border border-amber-200/80 bg-white/70 p-3.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={confirmValidate}
                          onChange={(e) => setConfirmValidate(e.target.checked)}
                          className={appCheckboxClass()}
                        />
                        <span>
                          <span className="block font-medium text-slate-900">
                            Confirmo a validação final do registo ATS
                          </span>
                          <span className="mt-1 block text-slate-600">
                            Após esta ação, não deverão existir mais correções a efetuar neste turno.
                          </span>
                        </span>
                      </label>

                      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowValidatePrompt(false);
                            setConfirmValidate(false);
                          }}
                          className={appButtonClass("secondary", "sm")}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={confirmValidateShift}
                          disabled={validating || !confirmValidate}
                          className={appButtonClass("primary", "sm")}
                        >
                          {validating ? "A validar..." : "Confirmar validação"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-600">
                  {shift.validated_at_utc
                    ? "Registo ATS validado."
                    : entries.length === 0
                    ? "Sem ocorrências ATS para validar neste turno."
                    : shift.status !== "OPEN"
                    ? "A validação só pode ser feita enquanto o turno estiver aberto."
                    : `Só o utilizador ${openedByName} que abriu o turno pode efetuar esta validação.`}
                </div>
              )}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
