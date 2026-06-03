"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import { formatUtcDateTime } from "@/lib/time";
import {
  appCheckboxClass,
  heroActionClass,
  InfoIcon,
  PageShell,
  SectionCard,
  SoftIcon,
} from "@/components/siro-ui";

type PreviewShift = {
  id: number;
  shift_code: string;
  operational_date: string;
  status: string;
  ats_unit_id: number | null;
  ats_units:
    | {
        name: string | null;
        code: string | null;
      }
    | {
        name: string | null;
        code: string | null;
      }[]
    | null;
};

type AtsUnitOption = {
  id: number;
  name: string;
  code: string;
};

type CleanupOverview = {
  counts: {
    shifts: number;
    occurrences: number;
    positionLogs: number;
  };
  preview: {
    counts: {
      shifts: number;
      occurrences: number;
      positionLogs: number;
    };
    shifts: PreviewShift[];
  } | null;
  units: AtsUnitOption[];
  profile: {
    role: string;
    full_name: string | null;
  };
};

type DashboardUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  ats_unit: {
    id: number;
    name: string;
    code: string;
  } | null;
  hasOpenShiftInUnit: boolean;
  isInShiftComposition: boolean;
  hasActivePosition: boolean;
  currentShiftCode: string | null;
};

type DashboardUnit = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  userCount: number;
  openShiftCount: number;
  closedShiftCount: number;
  occurrenceCount: number;
  activeLogCount: number;
};

type RecentShift = {
  id: number;
  shift_code: string;
  operational_date: string;
  status: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  validated_at_utc: string | null;
  ats_unit: {
    id: number;
    name: string;
    code: string;
  } | null;
  opened_by_name: string;
  validated_by_name: string;
};

type RecentOccurrence = {
  id: number;
  occurrence_number: string | null;
  occurrence_at_utc: string | null;
  severity: string | null;
  occurrence_category: {
    name: string | null;
    code: string | null;
  } | null;
  ats_unit: {
    id: number;
    name: string;
    code: string;
  } | null;
  shift_code: string;
  author_name: string;
};

type AdminDashboard = {
  generatedAtUtc: string;
  profile: {
    role: string;
    full_name: string | null;
  };
  system: {
    totalShifts: number;
    totalOccurrences: number;
    totalPositionLogs: number;
    totalOpenShifts: number;
    totalClosedShifts: number;
    totalValidatedShifts: number;
    totalActiveLogs: number;
    totalUnits: number;
    totalUsers: number;
  };
  roleOptions: string[];
  units: DashboardUnit[];
  users: DashboardUser[];
  recentShifts: RecentShift[];
  recentOccurrences: RecentOccurrence[];
};

type UserSortKey = "user" | "unit" | "role" | "status";
type UserSortDirection = "asc" | "desc";
type PendingAdminAction =
  | {
      kind: "create-user";
      title: string;
      description: string;
      confirmLabel: string;
    }
  | {
      kind: "edit-user";
      title: string;
      description: string;
      confirmLabel: string;
      userId: string;
    }
  | {
      kind: "delete-user";
      title: string;
      description: string;
      confirmLabel: string;
      userId: string;
      userLabel: string;
    }
  | {
      kind: "reset-records";
      title: string;
      description: string;
      confirmLabel: string;
    };

const ADMIN_USERS_PAGE_SIZE = 10;

function DatabaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
      <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h7A1.5 1.5 0 0 1 14 6.5V20" />
      <path d="M14 10.5A1.5 1.5 0 0 1 15.5 9h3A1.5 1.5 0 0 1 20 10.5V20" />
      <path d="M8 9h2M8 12h2M8 15h2M16 13h1.5M16 16h1.5M10.5 20v-3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M12 3 5 6v5c0 4.1 2.35 7.93 6 9 3.65-1.07 6-4.9 6-9V6l-7-3Z" />
      <path d="m9.5 11.5 1.7 1.7 3.3-3.7" />
    </svg>
  );
}

function UsersPanelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M16 21v-1.5A3.5 3.5 0 0 0 12.5 16H8.5A3.5 3.5 0 0 0 5 19.5V21" />
      <circle cx="10.5" cy="9" r="3" />
      <path d="M19 21v-1a3 3 0 0 0-2.2-2.9" />
      <path d="M15.5 6.3a3 3 0 0 1 0 5.4" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M3 12a9 9 0 1 0 2.64-6.36" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function TrashListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
      <path d="m6 6 1 13a2 2 0 0 0 2 1.85h6a2 2 0 0 0 2-1.85L18 6" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5 fill-none stroke-current stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SortIndicator({ value }: { value: string }) {
  const isActive = value !== "↕";

  return (
    <span
      className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-[0.35rem] border text-[10px] font-bold leading-none shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        isActive
          ? "border-[#2a67ba]/35 bg-[#eef4fb] text-[#1d4f91]"
          : "border-slate-300 bg-white text-slate-500"
      }`}
    >
      {value}
    </span>
  );
}

function getShiftUnitLabel(shift: PreviewShift) {
  const unit = Array.isArray(shift.ats_units) ? shift.ats_units[0] : shift.ats_units;
  if (!unit) return "Órgão não identificado";
  return unit.code || unit.name || "Órgão não identificado";
}

function getStatusTone(status: string) {
  if (status === "OPEN") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "CLOSED") return "text-slate-700 bg-slate-50 border-slate-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function getUserOperationalStatus(user: DashboardUser) {
  if (user.hasActivePosition) {
    return {
      label: "Na posição",
      detail: user.currentShiftCode ? `Turno ${user.currentShiftCode}` : "Posição ativa",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (user.isInShiftComposition) {
    return {
      label: "Em turno",
      detail: user.currentShiftCode ? `Turno ${user.currentShiftCode}` : "Turno aberto",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  return {
    label: "Sem turno",
    detail: "Sem atividade operacional",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  };
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userUpdating, setUserUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [cleanupOverview, setCleanupOverview] = useState<CleanupOverview | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = useState<number[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [atsUnitId, setAtsUnitId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userFilterUnit, setUserFilterUnit] = useState("");
  const [userFilterRole, setUserFilterRole] = useState("");
  const [userFilterStatus, setUserFilterStatus] = useState("");
  const [userSortKey, setUserSortKey] = useState<UserSortKey>("user");
  const [userSortDirection, setUserSortDirection] =
    useState<UserSortDirection>("asc");
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("asa12345");
  const [newUserRole, setNewUserRole] = useState("");
  const [newUserUnitId, setNewUserUnitId] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserUnitId, setEditUserUnitId] = useState("");
  const [editUserLabel, setEditUserLabel] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">(
    "info",
  );
  const [showSecurityNotice, setShowSecurityNotice] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [actionCountdown, setActionCountdown] = useState(20);

  const systemStats = useMemo(
    () => [
      { label: "Turnos", value: dashboard?.system.totalShifts ?? 0 },
      { label: "Ocorrências", value: dashboard?.system.totalOccurrences ?? 0 },
      { label: "Logs de posição", value: dashboard?.system.totalPositionLogs ?? 0 },
      { label: "Turnos abertos", value: dashboard?.system.totalOpenShifts ?? 0 },
      { label: "Logs ativos", value: dashboard?.system.totalActiveLogs ?? 0 },
      { label: "Utilizadores", value: dashboard?.system.totalUsers ?? 0 },
    ],
    [dashboard],
  );

  const previewStats = useMemo(
    () => [
      {
        label: "Turnos filtrados",
        value: cleanupOverview?.preview?.counts.shifts ?? 0,
      },
      {
        label: "Ocorrências filtradas",
        value: cleanupOverview?.preview?.counts.occurrences ?? 0,
      },
      {
        label: "Logs filtrados",
        value: cleanupOverview?.preview?.counts.positionLogs ?? 0,
      },
    ],
    [cleanupOverview],
  );

  const previewShiftIds = useMemo(
    () => cleanupOverview?.preview?.shifts.map((shift) => shift.id) ?? [],
    [cleanupOverview],
  );

  const allPreviewSelected =
    previewShiftIds.length > 0 && previewShiftIds.every((id) => selectedShiftIds.includes(id));

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const filtered = (dashboard?.users ?? []).filter((user) => {
      const status = getUserOperationalStatus(user).label;
      const matchesSearch =
        !q ||
        (user.full_name || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q) ||
        (user.ats_unit?.code || "").toLowerCase().includes(q) ||
        (user.ats_unit?.name || "").toLowerCase().includes(q);

      const matchesUnit =
        !userFilterUnit || String(user.ats_unit?.id || "") === userFilterUnit;
      const matchesRole = !userFilterRole || user.role === userFilterRole;
      const matchesStatus = !userFilterStatus || status === userFilterStatus;

      return matchesSearch && matchesUnit && matchesRole && matchesStatus;
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftStatus = getUserOperationalStatus(left).label;
      const rightStatus = getUserOperationalStatus(right).label;

      const leftValue =
        userSortKey === "user"
          ? `${left.full_name || ""} ${left.email || ""}`.trim().toLowerCase()
          : userSortKey === "unit"
            ? `${left.ats_unit?.code || ""} ${left.ats_unit?.name || ""}`
                .trim()
                .toLowerCase()
            : userSortKey === "role"
              ? left.role.toLowerCase()
              : leftStatus.toLowerCase();

      const rightValue =
        userSortKey === "user"
          ? `${right.full_name || ""} ${right.email || ""}`.trim().toLowerCase()
          : userSortKey === "unit"
            ? `${right.ats_unit?.code || ""} ${right.ats_unit?.name || ""}`
                .trim()
                .toLowerCase()
            : userSortKey === "role"
              ? right.role.toLowerCase()
              : rightStatus.toLowerCase();

      const comparison = leftValue.localeCompare(rightValue, "pt", {
        numeric: true,
        sensitivity: "base",
      });

      return userSortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [
    dashboard,
    userFilterRole,
    userFilterStatus,
    userFilterUnit,
    userSearch,
    userSortDirection,
    userSortKey,
  ]);

  const toggleUserSort = (key: UserSortKey) => {
    if (userSortKey === key) {
      setCurrentUserPage(1);
      setUserSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setCurrentUserPage(1);
    setUserSortKey(key);
    setUserSortDirection("asc");
  };

  const getUserSortIndicator = (key: UserSortKey) => {
    if (userSortKey !== key) return "↕";
    return userSortDirection === "asc" ? "↑" : "↓";
  };

  useEffect(() => {
    if (!pendingAction) return;

    const timer = window.setInterval(() => {
      setActionCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [pendingAction]);

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / ADMIN_USERS_PAGE_SIZE),
  );
  const safeCurrentUserPage = Math.min(currentUserPage, totalUserPages);
  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentUserPage - 1) * ADMIN_USERS_PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + ADMIN_USERS_PAGE_SIZE);
  }, [filteredUsers, safeCurrentUserPage]);
  const userPageStart = filteredUsers.length
    ? (safeCurrentUserPage - 1) * ADMIN_USERS_PAGE_SIZE + 1
    : 0;
  const userPageEnd = filteredUsers.length
    ? Math.min(safeCurrentUserPage * ADMIN_USERS_PAGE_SIZE, filteredUsers.length)
    : 0;

  const getSessionToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Sessão inválida. Entre novamente para aceder à administração.");
    }

    return session.access_token;
  }, []);

  const fetchDashboardData = useCallback(async () => {
    const token = await getSessionToken();

    const response = await fetch("/api/admin/overview", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        getFriendlyErrorMessage(
          "Não foi possível carregar o painel de administração",
          payload?.error ?? "Erro desconhecido",
        ),
      );
    }

    return payload as AdminDashboard;
  }, [getSessionToken]);

  const fetchCleanupOverview = useCallback(async (filters?: {
    dateFrom?: string;
    dateTo?: string;
    atsUnitId?: string;
  }) => {
    const token = await getSessionToken();

    const params = new URLSearchParams();
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    if (filters?.atsUnitId) params.set("atsUnitId", filters.atsUnitId);

    const response = await fetch(
      `/api/admin/reset-operational${params.toString() ? `?${params.toString()}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        getFriendlyErrorMessage(
          "Não foi possível carregar a gestão de registos",
          payload?.error ?? "Erro desconhecido",
        ),
      );
    }

    return payload as CleanupOverview;
  }, [getSessionToken]);

  const loadAdminData = useCallback(async () => {
    const [dashboardData, cleanupData] = await Promise.all([
      fetchDashboardData(),
      fetchCleanupOverview(),
    ]);

    setDashboard(dashboardData);
    setCleanupOverview(cleanupData);
    setNewUserRole((current) => current || dashboardData.roleOptions[0] || "");
  }, [fetchCleanupOverview, fetchDashboardData]);

  useEffect(() => {
    let active = true;

    async function loadInitialState() {
      try {
        await loadAdminData();
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Erro desconhecido");
        setMessageTone("error");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialState();

    return () => {
      active = false;
    };
  }, [loadAdminData]);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setMessage("");
    setConfirmReset(false);

    try {
      const payload = await fetchCleanupOverview({
        dateFrom,
        dateTo,
        atsUnitId,
      });
      setCleanupOverview(payload);
      setSelectedShiftIds(payload.preview?.shifts.map((shift) => shift.id) ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro desconhecido");
      setMessageTone("error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const executeReset = async () => {
    if (!confirmReset) {
      setMessage("Confirme a operação antes de limpar os registos.");
      setMessageTone("error");
      return;
    }

    if (!dateFrom && !dateTo && !atsUnitId) {
      setMessage(
        "Indique pelo menos uma data ou um órgão ATS para filtrar os registos a apagar.",
      );
      setMessageTone("error");
      return;
    }

    const token = await getSessionToken().catch(() => null);

    if (!token) {
      setMessage("Sessão inválida. Entre novamente para continuar.");
      setMessageTone("error");
      return;
    }

    setResetting(true);
    setMessage("");

    const response = await fetch("/api/admin/reset-operational", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        confirm: true,
        dateFrom,
        dateTo,
        atsUnitId,
        selectedShiftIds,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível limpar os registos operacionais",
          payload?.error ?? "Erro desconhecido",
        ),
      );
      setMessageTone("error");
      setResetting(false);
      return;
    }

    try {
      await loadAdminData();
      const refreshedCleanup = await fetchCleanupOverview({
        dateFrom,
        dateTo,
        atsUnitId,
      });
      setCleanupOverview(refreshedCleanup);
      setSelectedShiftIds([]);
    } catch {
      // Keep success message from deletion even if refresh partially fails.
    }

    setMessage(
      payload.message ?? "Registos operacionais filtrados removidos com sucesso.",
    );
    setMessageTone("success");
    setConfirmReset(false);
    setResetting(false);
  };

  const handleReset = () => {
    if (!confirmReset) {
      setMessage("Confirme a operação antes de limpar os registos.");
      setMessageTone("error");
      return;
    }

    if (!dateFrom && !dateTo && !atsUnitId) {
      setMessage(
        "Indique pelo menos uma data ou um órgão ATS para filtrar os registos a apagar.",
      );
      setMessageTone("error");
      return;
    }

    setActionCountdown(20);
    setPendingAction({
      kind: "reset-records",
      title: "Confirmar limpeza de registos operacionais",
      description:
        "Esta ação apaga turnos, ocorrências e logs de posição reais no Supabase, dentro do filtro e da seleção atual. Revise com cuidado antes de confirmar.",
      confirmLabel: "Confirmar limpeza",
    });
  };

  const toggleShiftSelection = (shiftId: number) => {
    setSelectedShiftIds((current) =>
      current.includes(shiftId)
        ? current.filter((id) => id !== shiftId)
        : [...current, shiftId],
    );
  };

  const handleSelectAllPreview = () => {
    if (allPreviewSelected) {
      setSelectedShiftIds([]);
      return;
    }

    setSelectedShiftIds(previewShiftIds);
  };

  const executeCreateUser = async () => {
    if (!newUserFullName || !newUserEmail || !newUserPassword || !newUserRole || !newUserUnitId) {
      setMessage("Preencha nome, email, palavra-passe, role e órgão ATS.");
      setMessageTone("error");
      return;
    }

    const token = await getSessionToken().catch(() => null);
    if (!token) {
      setMessage("Sessão inválida. Entre novamente para continuar.");
      setMessageTone("error");
      return;
    }

    setUserSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: newUserFullName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        atsUnitId: Number(newUserUnitId),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível criar o utilizador",
          payload?.error ?? "Erro desconhecido",
        ),
      );
      setMessageTone("error");
      setUserSaving(false);
      return;
    }

    await loadAdminData();
    setNewUserFullName("");
    setNewUserEmail("");
    setNewUserPassword("asa12345");
    setNewUserRole(dashboard?.roleOptions[0] ?? "");
    setNewUserUnitId("");
    setMessage(payload?.message ?? "Utilizador criado com sucesso.");
    setMessageTone("success");
    setUserSaving(false);
  };

  const handleCreateUser = () => {
    if (!newUserFullName || !newUserEmail || !newUserPassword || !newUserRole || !newUserUnitId) {
      setMessage("Preencha nome, email, palavra-passe, role e órgão ATS.");
      setMessageTone("error");
      return;
    }

    setActionCountdown(20);
    setPendingAction({
      kind: "create-user",
      title: "Confirmar criação de utilizador",
      description:
        "Vai criar um novo acesso no Supabase Auth e o respetivo profile operacional. Confirme apenas se os dados e o órgão ATS estiverem corretos.",
      confirmLabel: "Criar utilizador",
    });
  };

  const executeDeleteUser = async (userId: string) => {
    const token = await getSessionToken().catch(() => null);
    if (!token) {
      setMessage("Sessão inválida. Entre novamente para continuar.");
      setMessageTone("error");
      return;
    }

    setDeletingUserId(userId);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível apagar o utilizador",
          payload?.error ?? "Erro desconhecido",
        ),
      );
      setMessageTone("error");
      setDeletingUserId(null);
      return;
    }

    await loadAdminData();
    setMessage(payload?.message ?? "Utilizador apagado com sucesso.");
    setMessageTone("success");
    setDeletingUserId(null);
  };

  const openEditUser = (user: DashboardUser) => {
    setEditingUserId(user.id);
    setEditUserFullName(user.full_name || "");
    setEditUserEmail(user.email || "");
    setEditUserRole(user.role);
    setEditUserUnitId(user.ats_unit?.id ? String(user.ats_unit.id) : "");
    setEditUserLabel(user.full_name || user.email || "este utilizador");
  };

  const closeEditUser = () => {
    setEditingUserId(null);
    setEditUserFullName("");
    setEditUserEmail("");
    setEditUserRole("");
    setEditUserUnitId("");
    setEditUserLabel("");
  };

  const executeUpdateUser = async (userId: string) => {
    if (!editUserFullName || !editUserEmail || !editUserRole || !editUserUnitId) {
      setMessage("Preencha nome, email, role e órgão ATS para atualizar o utilizador.");
      setMessageTone("error");
      return;
    }

    const token = await getSessionToken().catch(() => null);
    if (!token) {
      setMessage("Sessão inválida. Entre novamente para continuar.");
      setMessageTone("error");
      return;
    }

    setUserUpdating(true);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        fullName: editUserFullName,
        email: editUserEmail,
        role: editUserRole,
        atsUnitId: Number(editUserUnitId),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível atualizar o utilizador",
          payload?.error ?? "Erro desconhecido",
        ),
      );
      setMessageTone("error");
      setUserUpdating(false);
      return;
    }

    await loadAdminData();
    closeEditUser();
    setMessage(payload?.message ?? "Utilizador atualizado com sucesso.");
    setMessageTone("success");
    setUserUpdating(false);
  };

  const handleUpdateUser = () => {
    if (!editingUserId) return;

    if (!editUserFullName || !editUserEmail || !editUserRole || !editUserUnitId) {
      setMessage("Preencha nome, email, role e órgão ATS para atualizar o utilizador.");
      setMessageTone("error");
      return;
    }

    setActionCountdown(20);
    setPendingAction({
      kind: "edit-user",
      title: "Confirmar atualização de utilizador",
      description: `Vai atualizar os dados do utilizador ${editUserLabel}, incluindo role e órgão ATS. Confirme apenas quando tiver certeza do impacto operacional da alteração.`,
      confirmLabel: "Guardar alterações",
      userId: editingUserId,
    });
  };

  const handleDeleteUser = (userId: string, userLabel: string) => {
    setActionCountdown(20);
    setPendingAction({
      kind: "delete-user",
      title: "Confirmar remoção de utilizador",
      description: `Vai remover o utilizador ${userLabel} do Auth e do profile operacional. Esta ação elimina o acesso ao sistema e deve ser feita com extremo cuidado.`,
      confirmLabel: "Apagar utilizador",
      userId,
      userLabel,
    });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction || actionCountdown > 0) return;

    const action = pendingAction;
    setPendingAction(null);

    if (action.kind === "create-user") {
      await executeCreateUser();
      return;
    }

    if (action.kind === "edit-user") {
      await executeUpdateUser(action.userId);
      return;
    }

    if (action.kind === "reset-records") {
      await executeReset();
      return;
    }

    await executeDeleteUser(action.userId);
  };

  return (
    <PageShell
      badge="Administração"
      title="Painel administrativo"
      subtitle="Backoffice do SIGO para visão global do sistema, auditoria operacional e gestão controlada dos registos."
      heroIcon={<DatabaseIcon />}
      compact
      heroThin
      footerActions={
        <Link href="/" className={heroActionClass()}>
          Painel principal
        </Link>
      }
    >
      <div className="space-y-6">
        {showSecurityNotice ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4">
            <div className="w-full max-w-2xl rounded-[1.2rem] border border-amber-200 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.5)] dark:border-amber-300/20 dark:bg-[rgba(16,25,41,0.96)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                Aviso de segurança
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-50">
                Painel administrativo com acesso a dados reais
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <p>
                  Este painel permite criar e remover utilizadores, consultar o estado global
                  do sistema e apagar registos operacionais reais no Supabase.
                </p>
                <p>
                  Qualquer alteração pode afetar turnos em curso, registos operacionais
                  ativos, histórico útil ou retirar acesso a utilizadores. Utilize apenas
                  quando tiver plena certeza do impacto da ação.
                </p>
                <p>
                  Proceda com especial cuidado nas áreas de gestão de utilizadores e gestão de
                  registos. Em caso de dúvida, não prossiga sem confirmar primeiro o impacto
                  da ação.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSecurityNotice(false)}
                  className="inline-flex items-center justify-center rounded-[0.85rem] border border-amber-500 bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:border-amber-600 hover:bg-amber-600"
                >
                  Compreendo os riscos
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingAction ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 px-4">
            <div className="w-full max-w-xl rounded-[1.2rem] border border-red-200 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.55)] dark:border-red-300/20 dark:bg-[rgba(16,25,41,0.98)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
                Confirmação reforçada
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-50">
                {pendingAction.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {pendingAction.description}
              </p>
              <div className="mt-5 rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-200">
                O botão de confirmação fica disponível em <strong>{actionCountdown}</strong>{" "}
                segundo(s).
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="inline-flex items-center justify-center rounded-[0.85rem] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPendingAction}
                  disabled={actionCountdown > 0}
                  className="inline-flex items-center justify-center rounded-[0.85rem] border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editingUserId ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 px-4">
            <div className="w-full max-w-2xl rounded-[1.2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.5)] dark:border-slate-600 dark:bg-[rgba(16,25,41,0.98)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1d4f91] dark:text-slate-300">
                Edição de utilizador
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-50">
                Atualizar utilizador
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Edite os dados abaixo e use a confirmação reforçada para guardar as alterações.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Nome completo
                  </span>
                  <input
                    type="text"
                    value={editUserFullName}
                    onChange={(e) => setEditUserFullName(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-[rgba(24,36,58,0.92)] dark:text-slate-100"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Email
                  </span>
                  <input
                    type="email"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-[rgba(24,36,58,0.92)] dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Role
                  </span>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-[rgba(24,36,58,0.92)] dark:text-slate-100"
                  >
                    <option value="">Selecionar role</option>
                    {(dashboard?.roleOptions ?? []).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Órgão ATS
                  </span>
                  <select
                    value={editUserUnitId}
                    onChange={(e) => setEditUserUnitId(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-[rgba(24,36,58,0.92)] dark:text-slate-100"
                  >
                    <option value="">Selecionar órgão ATS</option>
                    {(cleanupOverview?.units ?? []).map((unit) => (
                      <option key={unit.id} value={String(unit.id)}>
                        {unit.code} · {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    editingUserId &&
                    handleDeleteUser(editingUserId, editUserLabel || "este utilizador")
                  }
                  disabled={deletingUserId === editingUserId || userUpdating}
                  className="inline-flex items-center justify-center rounded-[0.85rem] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition duration-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingUserId === editingUserId ? "A apagar..." : "Apagar utilizador"}
                </button>
                <button
                  type="button"
                  onClick={closeEditUser}
                  className="inline-flex items-center justify-center rounded-[0.85rem] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdateUser}
                  disabled={userUpdating}
                  className="inline-flex items-center justify-center rounded-[0.85rem] border border-[#1d4f91] bg-[#1d4f91] px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:border-[#163d70] hover:bg-[#163d70] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {userUpdating ? "A guardar..." : "Guardar alterações"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {message ? (
          <div
            className={`rounded-[0.9rem] border px-4 py-4 text-sm ${
              messageTone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : messageTone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <SectionCard
          icon={
            <SoftIcon tone="blue">
              <ShieldIcon />
            </SoftIcon>
          }
          title="Estado do sistema"
          subtitle="Resumo global do SIGO para acompanhamento imediato do ambiente operacional."
        >
          {loading ? (
            <div className="text-sm text-slate-500">A carregar estado do sistema...</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {systemStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[0.9rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Acesso reservado a <strong>ADMIN</strong>. Atualizado em{" "}
                <strong>{formatUtcDateTime(dashboard?.generatedAtUtc)}</strong>.
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="emerald">
              <BuildingIcon />
            </SoftIcon>
          }
          title="Órgãos ATS"
          subtitle="Visão resumida por ambiente operacional, com utilizadores, turnos e atividade recente."
        >
          {loading ? (
            <div className="text-sm text-slate-500">A carregar órgãos ATS...</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {(dashboard?.units ?? []).map((unit) => (
                <div
                  key={unit.id}
                  className="app-surface-subtle rounded-[0.95rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {unit.code}
                      </div>
                      <div className="mt-1 text-[17px] font-semibold text-slate-950">
                        {unit.name}
                      </div>
                    </div>
                    <span
                      className={`rounded-[0.7rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        unit.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {unit.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Utilizadores
                      </div>
                      <div className="mt-1 font-bold text-slate-950">{unit.userCount}</div>
                    </div>
                    <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Turnos abertos
                      </div>
                      <div className="mt-1 font-bold text-slate-950">
                        {unit.openShiftCount}
                      </div>
                    </div>
                    <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Ocorrências
                      </div>
                      <div className="mt-1 font-bold text-slate-950">
                        {unit.occurrenceCount}
                      </div>
                    </div>
                    <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Logs ativos
                      </div>
                      <div className="mt-1 font-bold text-slate-950">
                        {unit.activeLogCount}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="violet">
              <UsersPanelIcon />
            </SoftIcon>
          }
          title="Gestão de utilizadores"
          subtitle="Leitura administrativa dos perfis existentes, órgão ATS associado e contexto operacional atual."
        >
          <div className="grid gap-4 rounded-[0.95rem] border border-slate-200 bg-slate-50/70 px-4 py-4 lg:grid-cols-5">
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Nome completo
              </span>
              <input
                type="text"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Email
              </span>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Palavra-passe
              </span>
              <input
                type="text"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Role
              </span>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              >
                <option value="">Selecionar role</option>
                {(dashboard?.roleOptions ?? []).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Órgão ATS
              </span>
              <select
                value={newUserUnitId}
                onChange={(e) => setNewUserUnitId(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              >
                <option value="">Selecionar órgão ATS</option>
                {(cleanupOverview?.units ?? []).map((unit) => (
                  <option key={unit.id} value={String(unit.id)}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={userSaving || loading}
                className="inline-flex w-full items-center justify-center rounded-[0.8rem] border border-[#1d4f91] bg-[#1d4f91] px-4 py-2.5 text-[14px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#163d70] hover:bg-[#163d70] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {userSaving ? "A criar..." : "Criar utilizador"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setCurrentUserPage(1);
                  setUserSearch(e.target.value);
                }}
                placeholder="Pesquisar por nome, email, role ou órgão ATS"
                className="w-full rounded-[0.8rem] border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900"
              />
            </div>
            <select
              value={userFilterUnit}
              onChange={(e) => {
                setCurrentUserPage(1);
                setUserFilterUnit(e.target.value);
              }}
              className="w-full rounded-[0.8rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
            >
              <option value="">Todos os órgãos</option>
              {(dashboard?.units ?? []).map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.code}
                </option>
              ))}
            </select>
            <select
              value={userFilterRole}
              onChange={(e) => {
                setCurrentUserPage(1);
                setUserFilterRole(e.target.value);
              }}
              className="w-full rounded-[0.8rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
            >
              <option value="">Todas as roles</option>
              {(dashboard?.roleOptions ?? []).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              value={userFilterStatus}
              onChange={(e) => {
                setCurrentUserPage(1);
                setUserFilterStatus(e.target.value);
              }}
              className="w-full rounded-[0.8rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
            >
              <option value="">Todos os estados</option>
              <option value="Na posição">Na posição</option>
              <option value="Em turno">Em turno</option>
              <option value="Sem turno">Sem turno</option>
            </select>
          </div>

          <div className="app-surface-subtle mt-4 rounded-[0.95rem] border border-slate-200 bg-white">
            <div className="grid grid-cols-[1.4fr_1.1fr_0.8fr_1fr_0.7fr] gap-4 border-b border-slate-200/30 bg-slate-50/70 px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
              <button
                type="button"
                onClick={() => toggleUserSort("user")}
                className="inline-flex items-center gap-1.5 text-left uppercase transition hover:text-slate-800"
              >
                <span>UTILIZADOR</span>
                <SortIndicator value={getUserSortIndicator("user")} />
              </button>
              <button
                type="button"
                onClick={() => toggleUserSort("unit")}
                className="inline-flex items-center gap-1.5 text-left uppercase transition hover:text-slate-800"
              >
                <span>ÓRGÃO ATS</span>
                <SortIndicator value={getUserSortIndicator("unit")} />
              </button>
              <button
                type="button"
                onClick={() => toggleUserSort("role")}
                className="inline-flex items-center gap-1.5 text-left uppercase transition hover:text-slate-800"
              >
                <span>ROLE</span>
                <SortIndicator value={getUserSortIndicator("role")} />
              </button>
              <button
                type="button"
                onClick={() => toggleUserSort("status")}
                className="inline-flex items-center gap-1.5 text-left uppercase transition hover:text-slate-800"
              >
                <span>ESTADO</span>
                <SortIndicator value={getUserSortIndicator("status")} />
              </button>
              <span className="text-right uppercase">AÇÕES</span>
            </div>
            <div className="divide-y divide-slate-200/30">
              {paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className="grid grid-cols-[1.4fr_1.1fr_0.8fr_1fr_0.7fr] gap-4 px-4 py-3 text-sm text-slate-600"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {user.full_name || "Sem nome"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">{user.email || "—"}</div>
                  </div>
                  <div className="self-center">
                    {user.ats_unit ? `${user.ats_unit.code} · ${user.ats_unit.name}` : "—"}
                  </div>
                  <div className="self-center font-medium text-slate-800">{user.role}</div>
                  <div className="self-center">
                    {(() => {
                      const operationalStatus = getUserOperationalStatus(user);

                      return (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit rounded-[0.7rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${operationalStatus.className}`}
                          >
                            {operationalStatus.label}
                          </span>
                          <span className="text-[12px] text-slate-500">
                            {operationalStatus.detail}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="self-center text-right">
                    <button
                      type="button"
                      onClick={() => openEditUser(user)}
                      disabled={userUpdating || deletingUserId === user.id}
                      className="inline-flex items-center justify-center rounded-[0.72rem] border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition duration-200 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
              {!paginatedUsers.length ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Nenhum utilizador encontrado com os filtros atuais.
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/30 px-4 py-3 text-sm text-slate-500">
              <div>
                {filteredUsers.length
                  ? `A mostrar ${userPageStart}-${userPageEnd} de ${filteredUsers.length}`
                  : "A mostrar 0 de 0"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentUserPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentUserPage === 1}
                  className="rounded-[0.72rem] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Página {safeCurrentUserPage} / {totalUserPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentUserPage((page) => Math.min(totalUserPages, page + 1))
                  }
                  disabled={safeCurrentUserPage >= totalUserPages}
                  className="rounded-[0.72rem] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Seguinte
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="slate">
              <HistoryIcon />
            </SoftIcon>
          }
          title="Auditoria operacional"
          subtitle="Turnos recentes com o respetivo contexto operacional, incluindo ocorrências associadas."
        >
          <div className="app-surface-subtle rounded-[0.95rem] border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-[13px] font-semibold text-slate-800">Atividade recente por turno</div>
              <div className="mt-1 text-[12px] text-slate-500">
                Cada turno mostra o seu estado, responsáveis e resumo das ocorrências já registadas.
              </div>
            </div>
            <div className="space-y-3 px-4 py-4">
              {(dashboard?.recentShifts ?? []).length ? (
                (dashboard?.recentShifts ?? []).map((shift) => {
                  const relatedOccurrences = (dashboard?.recentOccurrences ?? []).filter(
                    (occurrence) => occurrence.shift_code === shift.shift_code,
                  );

                  return (
                    <div
                      key={shift.id}
                      className="rounded-[0.95rem] border border-slate-200/70 bg-slate-50/70 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-950">
                            {shift.shift_code}
                          </div>
                          <div className="mt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            {shift.ats_unit?.code || "—"} · {shift.operational_date}
                          </div>
                        </div>
                        <span
                          className={`rounded-[0.7rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getStatusTone(
                            shift.status,
                          )}`}
                        >
                          {shift.status}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 lg:grid-cols-3">
                        <div className="rounded-[0.75rem] border border-slate-200/80 bg-white/70 px-3 py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Aberto por
                          </div>
                          <div className="mt-1 text-[13px] font-medium text-slate-700">
                            {shift.opened_by_name}
                          </div>
                        </div>
                        <div className="rounded-[0.75rem] border border-slate-200/80 bg-white/70 px-3 py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Último marco
                          </div>
                          <div className="mt-1 text-[13px] font-medium text-slate-700">
                            {shift.end_time_utc
                              ? `Fechado em ${formatUtcDateTime(shift.end_time_utc)}`
                              : shift.validated_at_utc
                                ? `Validado por ${shift.validated_by_name}`
                                : "Ainda não validado"}
                          </div>
                        </div>
                        <div className="rounded-[0.75rem] border border-slate-200/80 bg-white/70 px-3 py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Ocorrências ATS
                          </div>
                          <div className="mt-1 text-[13px] font-medium text-slate-700">
                            {relatedOccurrences.length
                              ? `${relatedOccurrences.length} registada(s)`
                              : "Sem ocorrências"}
                          </div>
                        </div>
                      </div>

                      {relatedOccurrences.length ? (
                        <div className="mt-3 rounded-[0.8rem] border border-slate-200/80 bg-white/75 px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Ocorrências do turno
                          </div>
                          <div className="mt-2 space-y-2">
                            {relatedOccurrences.map((occurrence, index) => (
                              <div
                                key={occurrence.id}
                                className="rounded-[0.72rem] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700"
                              >
                                <span className="font-semibold text-slate-800">
                                  {occurrence.occurrence_number || `OCC ${index + 1}`}
                                </span>
                                {" - "}
                                <span>
                                  {occurrence.occurrence_category?.name ||
                                    occurrence.severity ||
                                    "Tipo não indicado"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[0.9rem] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  Sem turnos recentes para apresentar.
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="amber">
              <TrashListIcon />
            </SoftIcon>
          }
          title="Gestão de registos"
          subtitle="Limpeza controlada de turnos, ocorrências e logs de posição, com filtros e seleção manual."
        >
          <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            Esta área apaga registos operacionais reais no Supabase. Utilize apenas para
            preparar novos testes ou higienizar dados de ambiente controlado.
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Data inicial
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Data final
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">
                Órgão ATS
              </span>
              <select
                value={atsUnitId}
                onChange={(e) => setAtsUnitId(e.target.value)}
                className="w-full rounded-[0.75rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
              >
                <option value="">Todos os órgãos</option>
                {(cleanupOverview?.units ?? []).map((unit) => (
                  <option key={unit.id} value={String(unit.id)}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || loading}
              className="inline-flex items-center justify-center rounded-[0.8rem] border border-[#1d4f91] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1d4f91] transition duration-200 hover:-translate-y-0.5 hover:bg-[#eef4fb] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewLoading ? "A pré-visualizar..." : "Pré-visualizar registos"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {previewStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {cleanupOverview?.preview?.shifts?.length ? (
            <div className="mt-5 rounded-[0.9rem] border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="text-[13px] font-semibold text-slate-700">
                  Turnos incluídos na pré-visualização
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllPreview}
                  className="inline-flex items-center justify-center rounded-[0.7rem] border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition duration-200 hover:bg-slate-100"
                >
                  {allPreviewSelected ? "Limpar seleção" : "Selecionar todos"}
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {cleanupOverview.preview.shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex flex-col gap-3 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between"
                  >
                    <label className="flex items-start gap-3 md:items-center">
                      <input
                        type="checkbox"
                        checked={selectedShiftIds.includes(shift.id)}
                        onChange={() => toggleShiftSelection(shift.id)}
                        className={`${appCheckboxClass()} md:mt-0`}
                      />
                      <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-5">
                        <span className="font-medium text-slate-900">
                          {shift.shift_code}
                        </span>
                        <span>{getShiftUnitLabel(shift)}</span>
                        <span>{shift.operational_date}</span>
                        <span>{shift.status}</span>
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {selectedShiftIds.length} turno(s) selecionado(s)
              </div>
            </div>
          ) : null}

          <label className="mt-4 flex items-start gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={confirmReset}
              onChange={(e) => setConfirmReset(e.target.checked)}
              className={appCheckboxClass()}
            />
            <span>
              Confirmo que pretendo apagar os registos operacionais selecionados.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting || loading || previewLoading}
              className="inline-flex items-center justify-center rounded-[0.8rem] border border-red-600 bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetting ? "A limpar..." : "Apagar registos selecionados"}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="blue">
              <InfoIcon />
            </SoftIcon>
          }
          title="Notas administrativas"
          subtitle="Referências rápidas sobre o comportamento atual do backoffice."
          compact
        >
          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-[0.85rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
              O painel está limitado ao perfil <strong>ADMIN</strong> e trabalha
              diretamente sobre os dados reais do Supabase.
            </div>
            <div className="rounded-[0.85rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
              A gestão de registos apaga apenas <strong>turnos</strong>,{" "}
              <strong>ocorrências</strong> e <strong>logs de posição</strong>.
              Perfis, utilizadores e órgãos ATS mantêm-se intactos.
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
