"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  appButtonClass,
  appFieldClass,
  appLabelClass,
  FileIcon,
  heroActionClass,
  PageShell,
  SectionCard,
  SelectField,
  SoftIcon,
} from "@/components/siro-ui";

type ShiftStaffRow = {
  role_in_shift: string | null;
};

type ShiftRow = {
  id: number;
  shift_code: string;
  operational_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  status: string;
  opening_notes: string | null;
  handover_notes: string | null;
  shift_staff?: ShiftStaffRow[] | null;
};

const PAGE_SIZE = 20;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

export default function OccurrencesPage() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
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
          .select("id, email, role, ats_unit_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (profileError || !profileData) {
          setMessage("Não foi possível carregar o perfil.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("shifts")
          .select(
            `
            id,
            shift_code,
            operational_date,
            start_time_utc,
            end_time_utc,
            status,
            opening_notes,
            handover_notes,
            shift_staff (
              role_in_shift
            )
          `,
          )
          .eq("ats_unit_id", profileData.ats_unit_id)
          .order("operational_date", { ascending: false })
          .order("id", { ascending: false });

        if (!active) return;

        if (error) {
          setMessage(`Erro ao carregar registos ATS: ${error.message}`);
          setLoading(false);
          return;
        }

        setRows((data as ShiftRow[]) || []);
        setLoading(false);
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const getSupervisorName = (row: ShiftRow) => {
    const supervisor = row.shift_staff?.find((item) =>
      (item.role_in_shift || "").toLowerCase().startsWith("supervisor"),
    );

    if (!supervisor?.role_in_shift) return "Supervisor não indicado";

    const parts = supervisor.role_in_shift.split("·");
    if (parts.length > 1) {
      return parts.slice(1).join("·").trim() || "Supervisor não indicado";
    }

    return supervisor.role_in_shift.trim() || "Supervisor não indicado";
  };

  const getSummaryText = (row: ShiftRow) => {
    return row.handover_notes || row.opening_notes || "Sem notas adicionais.";
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = search.toLowerCase();

      const matchesSearch =
        !search ||
        row.shift_code?.toLowerCase().includes(q) ||
        row.operational_date?.toLowerCase().includes(q) ||
        row.status?.toLowerCase().includes(q) ||
        row.opening_notes?.toLowerCase().includes(q) ||
        row.handover_notes?.toLowerCase().includes(q) ||
        getSupervisorName(row).toLowerCase().includes(q);

      const matchesStatus = !statusFilter || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safeCurrentPage]);

  const inputClass = appFieldClass();

  const getStatusBadge = (status: string) => {
    return status === "OPEN"
      ? "border-emerald-300 bg-emerald-100 text-emerald-800"
      : "border-slate-300 bg-slate-100 text-slate-700";
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-PT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pageStart =
    filteredRows.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, filteredRows.length);

  return (
    <PageShell
      badge="Registo de Ocorrências ATS"
      title="Registo de Ocorrências ATS"
      subtitle=""
      heroIcon={<FileIcon />}
      compact
      heroThin
      actions={
        <>
          <Link
            href="/occurrences/new"
            className={heroActionClass("primary")}
          >
            Nova entrada
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
        <div className="mb-6 rounded-[0.9rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <SectionCard
        icon={
          <SoftIcon tone="orange">
            <FileIcon />
          </SoftIcon>
        }
        title="Filtros"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Pesquisa
            </label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={`${inputClass} pl-11`}
                placeholder="Pesquisar por referência, supervisor, data, notas..."
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <SearchIcon />
              </div>
            </div>
          </div>

          <div>
            <label className={appLabelClass()}>
              Estado
            </label>
            <SelectField
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </SelectField>
          </div>
        </div>
      </SectionCard>

      <div className="mt-6">
        <SectionCard
          icon={
            <SoftIcon tone="blue">
              <ListIcon />
            </SoftIcon>
          }
          title="Lista de registos"
          subtitle={
            loading
              ? "A carregar registos ATS..."
              : `${filteredRows.length} registo(s) encontrado(s).`
          }
        >
          {loading ? (
            <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              A carregar...
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Não foram encontrados registos ATS com os filtros atuais.
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[0.9rem] border border-slate-200">
                {paginatedRows.map((row, index) => (
                  <Link
                    key={row.id}
                    href={`/occurrences/${row.id}`}
                    className={`block bg-white px-5 py-4 transition hover:bg-blue-50 ${
                      index !== paginatedRows.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_150px] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {row.shift_code}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-700">
                          <span className="font-medium">Supervisor:</span>{" "}
                          {getSupervisorName(row)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-[0.6rem] border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadge(
                              row.status,
                            )}`}
                          >
                            {row.status}
                          </span>
                          <span className="text-sm text-slate-500">
                            {row.operational_date}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {getSummaryText(row)}
                        </p>
                      </div>

                      <div className="text-sm text-slate-500 lg:text-right">
                        {formatDateTime(row.start_time_utc)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-500">
                  A mostrar{" "}
                  <span className="font-medium text-slate-700">
                    {pageStart}
                  </span>
                  –<span className="font-medium text-slate-700">{pageEnd}</span>{" "}
                  de{" "}
                  <span className="font-medium text-slate-700">
                    {filteredRows.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={safeCurrentPage === 1}
                    className={appButtonClass("secondary", "xs")}
                  >
                    Anterior
                  </button>

                  <span className="inline-flex items-center justify-center rounded-[0.65rem] border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                    {pageStart}–{pageEnd}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={safeCurrentPage === totalPages}
                    className={appButtonClass("secondary", "xs")}
                  >
                    Seguinte
                  </button>
                </div>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
