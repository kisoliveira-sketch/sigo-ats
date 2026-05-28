"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";
import {
  FileIcon,
  GridIcon,
  LoginIcon,
  LockIcon,
  LogoutIcon,
  UsersIcon,
  appButtonClass,
} from "@/components/siro-ui";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  ats_unit_id: number | null;
};

type AtsUnit = {
  id: number;
  name: string;
  code: string;
};

type Shift = {
  id: number;
  shift_code: string;
  status: string;
  operational_date?: string;
  opened_by?: string | null;
  end_time_utc?: string | null;
  validated_at_utc?: string | null;
  opening_notes?: string | null;
};

type ActivePositionLog = {
  id: number;
  user_id: string;
  entered_at_utc: string;
  left_at_utc: string | null;
  notes: string | null;
  user_name: string;
};

function extractCompositionLines(openingNotes?: string | null) {
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

function extractSupervisorName(openingNotes?: string | null) {
  const supervisorLine = extractCompositionLines(openingNotes).find((line) =>
    line.toLowerCase().startsWith("supervisor:"),
  );

  return supervisorLine
    ? supervisorLine.split(":").slice(1).join(":").trim() || null
    : null;
}

function extractUserShiftRole(
  openingNotes: string | null | undefined,
  profile?: { full_name?: string | null; email?: string | null } | null,
) {
  if (!profile) return null;

  const lines = extractCompositionLines(openingNotes);
  if (lines.length === 0) return null;

  const fullName = profile.full_name?.trim().toLowerCase();
  const email = profile.email?.trim().toLowerCase();

  for (const line of lines) {
    const [rolePart, ...memberParts] = line.split(":");
    const member = memberParts.join(":").trim().toLowerCase();

    if ((fullName && member === fullName) || (email && member === email)) {
      return rolePart.trim() || null;
    }
  }

  return null;
}

function isUserInShiftComposition(
  openingNotes: string | null | undefined,
  profile?: { full_name?: string | null; email?: string | null } | null,
) {
  if (!profile) return false;

  const lines = extractCompositionLines(openingNotes);
  if (lines.length === 0) return false;

  const fullName = profile.full_name?.trim().toLowerCase();
  const email = profile.email?.trim().toLowerCase();

  return lines.some((line) => {
    const member = line.split(":").slice(1).join(":").trim().toLowerCase();
    return (fullName && member === fullName) || (email && member === email);
  });
}

const dashboardLineIconClass =
  "h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 1.8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function ProfileBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.2" />
      <circle cx="12" cy="9" r="2.6" />
      <path d="M8.5 16c.95-1.55 2.14-2.35 3.5-2.35s2.55.8 3.5 2.35" />
      <path d="M7.5 6.5h1.2" />
      <path d="M15.3 6.5h1.2" />
    </svg>
  );
}

function PlayTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M8 6.8v10.4c0 .5.53.82.97.58l8.08-5.2a.67.67 0 0 0 0-1.12L8.97 6.22A.67.67 0 0 0 8 6.8Z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.8 12.1 2.1 2.1 4.7-5" />
    </svg>
  );
}

function SystemDot({ tone = "green" }: { tone?: "green" | "slate" | "orange" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "orange"
      ? "bg-amber-500"
      : "bg-slate-400";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M15 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="M4.5 19.5h15" />
      <path d="M7.5 17V11" />
      <path d="M12 17V7" />
      <path d="M16.5 17v-4" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m5.5 7.5 6.5 5 6.5-5" />
    </svg>
  );
}

function EyeIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!open && <path d="M4 20 20 4" />}
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className={dashboardLineIconClass}>
      <rect x="4" y="5" width="16" height="15" rx="2.4" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 9.5h16" />
      <circle cx="16.5" cy="16.2" r="2.2" />
    </svg>
  );
}

function QuickAccessCard({
  title,
  description,
  icon,
  badge,
  href,
  locked = false,
  accent = "slate",
}: {
  title: string;
  description: string;
  icon: ReactNode;
  badge: string;
  href?: string;
  locked?: boolean;
  accent?: "orange" | "blue" | "slate";
}) {
  const wrapperClass =
    "w-full md:w-[calc(50%-0.5rem)] xl:min-w-0 xl:basis-[calc((100%-3rem)/4)]";
  const accentClasses =
    accent === "orange"
      ? {
          card: "border-orange-200 hover:border-orange-300",
          icon: "border-orange-200 bg-orange-50 text-[#f28c28]",
          badge: "bg-orange-50 text-[#f28c28]",
          chevron: "group-hover:text-[#f28c28]",
        }
      : accent === "blue"
      ? {
          card: "border-slate-200 hover:border-blue-300",
          icon: "border-blue-200 bg-[#eef4fb] text-[#1d4f91]",
          badge: "bg-[#eef4fb] text-[#1d4f91]",
          chevron: "group-hover:text-[#1d4f91]",
        }
      : {
          card: "border-slate-200 hover:border-slate-300",
          icon: "border-slate-200 bg-slate-50 text-slate-600",
          badge: "bg-slate-100 text-slate-600",
          chevron: "group-hover:text-slate-700",
        };

  const content = (
    <div
      className={`group flex h-full min-h-[118px] items-stretch justify-between gap-2 rounded-[0.95rem] border bg-white px-4 py-2.5 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 ${accentClasses.card}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.75rem] border ${accentClasses.icon}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-[15px] font-semibold leading-6 text-slate-900">
            {title}
          </p>
          <p className="mt-1 text-[12px] leading-[1.2rem] text-slate-600">
            {description}
          </p>
        </div>
      </div>

      <div className="flex min-w-[56px] shrink-0 flex-col items-end justify-end pl-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-[0.65rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${accentClasses.badge}`}
          >
            {badge}
          </span>
          <span
            className={`text-slate-300 transition ${locked ? "" : accentClasses.chevron}`}
          >
            {locked ? <LockIcon /> : <ChevronRightIcon />}
          </span>
        </div>
      </div>
    </div>
  );

  if (locked || !href) {
    return <div className={wrapperClass}>{content}</div>;
  }

  return (
    <Link href={href} className={`block h-full ${wrapperClass}`}>
      {content}
    </Link>
  );
}

function hasRecoveryParamsInUrl() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);

  return (
    searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    (searchParams.has("code") && searchParams.get("type") === "recovery") ||
    (hashParams.has("access_token") && hashParams.get("type") === "recovery") ||
    searchParams.has("token_hash")
  );
}

function DashboardIconBox({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "orange" | "slate";
}) {
  const toneClass =
    tone === "orange"
      ? "border-orange-200 bg-orange-50 text-[#f28c28]"
      : tone === "slate"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : "border-blue-200 bg-[#eef4fb] text-[#1d4f91]";

  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-[0.8rem] border ${toneClass}`}
    >
      {children}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const isLoggingOutRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info">("info");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [atsUnit, setAtsUnit] = useState<AtsUnit | null>(null);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [openShiftOpenedByName, setOpenShiftOpenedByName] = useState("—");
  const [lastClosedShift, setLastClosedShift] = useState<Shift | null>(null);
  const [activeOccurrencesCount, setActiveOccurrencesCount] = useState(0);
  const [activePendingCount, setActivePendingCount] = useState(0);
  const [activePositionLogs, setActivePositionLogs] = useState<ActivePositionLog[]>([]);
  const [positionLogsCount, setPositionLogsCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const loadProfileAndShift = async (
    userId?: string,
    mounted: boolean = true,
  ) => {
    if (isLoggingOutRef.current) return;
    try {
      let resolvedUserId = userId;

      if (!resolvedUserId) {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted || isLoggingOutRef.current) return;

        if (sessionError) {
          setMessage(
            getFriendlyErrorMessage(
              "Não foi possível validar a tua sessão",
              sessionError.message,
            ),
          );
          setProfile(null);
          setAtsUnit(null);
          setOpenShift(null);
          setOpenShiftOpenedByName("—");
          setLastClosedShift(null);
          setActiveOccurrencesCount(0);
          setActivePendingCount(0);
          setActivePositionLogs([]);
          setPositionLogsCount(0);
          return;
        }

        if (!session?.user) {
          setProfile(null);
          setAtsUnit(null);
          setOpenShift(null);
          setOpenShiftOpenedByName("—");
          setLastClosedShift(null);
          setActiveOccurrencesCount(0);
          setActivePendingCount(0);
          setActivePositionLogs([]);
          setPositionLogsCount(0);
          return;
        }

        resolvedUserId = session.user.id;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, ats_unit_id")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (!mounted || isLoggingOutRef.current) return;

      if (error) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar o teu perfil",
            error.message,
          ),
        );
        setProfile(null);
        setAtsUnit(null);
        setOpenShift(null);
        setOpenShiftOpenedByName("—");
        setLastClosedShift(null);
        setActiveOccurrencesCount(0);
        setActivePendingCount(0);
        setActivePositionLogs([]);
        setPositionLogsCount(0);
        return;
      }

      if (!data) {
        setMessage("Perfil não encontrado.");
        setProfile(null);
        setAtsUnit(null);
        setOpenShift(null);
        setOpenShiftOpenedByName("—");
        setLastClosedShift(null);
        setActiveOccurrencesCount(0);
        setActivePendingCount(0);
        setActivePositionLogs([]);
        setPositionLogsCount(0);
        return;
      }

      setProfile(data);
      setMessage("");

      if (!data.ats_unit_id) {
        setAtsUnit(null);
        setOpenShift(null);
        setOpenShiftOpenedByName("—");
        setLastClosedShift(null);
        setActiveOccurrencesCount(0);
        setActivePendingCount(0);
        return;
      }

      const { data: unitData, error: unitError } = await supabase
        .from("ats_units")
        .select("id, name, code")
        .eq("id", data.ats_unit_id)
        .maybeSingle();

      if (!mounted || isLoggingOutRef.current) return;

      if (unitError) {
        setAtsUnit(null);
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível carregar a unidade ATS",
            unitError.message,
          ),
        );
      } else {
        setAtsUnit(unitData || null);
      }

      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .select("id, shift_code, status, operational_date, opened_by, validated_at_utc, opening_notes")
        .eq("ats_unit_id", data.ats_unit_id)
        .eq("status", "OPEN")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted || isLoggingOutRef.current) return;

      if (shiftError) {
        setMessage(
          getFriendlyErrorMessage(
            "Não foi possível verificar se existe um turno aberto",
            shiftError.message,
          ),
        );
        setOpenShift(null);
        setOpenShiftOpenedByName("—");
        return;
      }

      setOpenShift(shiftData || null);

      if (shiftData?.opened_by) {
        const { data: openerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", shiftData.opened_by)
          .maybeSingle();

        if (!mounted || isLoggingOutRef.current) return;

        setOpenShiftOpenedByName(openerProfile?.full_name || "—");
      } else {
        setOpenShiftOpenedByName("—");
      }

      const { data: closedShiftData } = await supabase
        .from("shifts")
        .select("id, shift_code, status, operational_date, end_time_utc")
        .eq("ats_unit_id", data.ats_unit_id)
        .eq("status", "CLOSED")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted || isLoggingOutRef.current) return;
      setLastClosedShift(closedShiftData || null);
    } catch (error) {
      if (!mounted || isLoggingOutRef.current) return;

      const message =
        error instanceof Error ? error.message : "Erro inesperado ao carregar a aplicação";

      setMessage(getFriendlyErrorMessage("Não foi possível carregar a aplicação", message));
      setProfile(null);
      setAtsUnit(null);
      setOpenShift(null);
      setOpenShiftOpenedByName("—");
      setLastClosedShift(null);
      setActiveOccurrencesCount(0);
      setActivePendingCount(0);
      setActivePositionLogs([]);
      setPositionLogsCount(0);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (isLoggingOutRef.current) return;
      if (hasRecoveryParamsInUrl()) {
        setIsPasswordRecoveryMode(true);
        setBooting(false);
        setNotice("Defina a nova palavra-passe para concluir a recuperação da conta.");
        setNoticeTone("info");
        return;
      }
      await loadProfileAndShift(undefined, mounted);
      if (mounted) setBooting(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (isLoggingOutRef.current) return;
      if (event === "INITIAL_SESSION") return;

      if (event === "PASSWORD_RECOVERY" || hasRecoveryParamsInUrl()) {
        setIsPasswordRecoveryMode(true);
        setBooting(false);
        setProfile(null);
        setAtsUnit(null);
        setOpenShift(null);
        setOpenShiftOpenedByName("—");
        setLastClosedShift(null);
        setActiveOccurrencesCount(0);
        setActivePendingCount(0);
        setActivePositionLogs([]);
        setPositionLogsCount(0);
        setNotice("Defina a nova palavra-passe para concluir a recuperação da conta.");
        setNoticeTone("info");
        setMessage("");
        return;
      }

      void (async () => {
        await loadProfileAndShift(session?.user?.id, mounted);
        if (mounted) setBooting(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const currentShiftId = openShift?.id;

    const loadShiftCounters = async () => {
      if (!currentShiftId) {
        if (!active) return;
        setActiveOccurrencesCount(0);
        setActivePendingCount(0);
        return;
      }

      const [{ count: totalCount }, { count: pendingCount }] = await Promise.all([
        supabase
          .from("occurrences")
          .select("*", { count: "exact", head: true })
          .eq("shift_id", currentShiftId),
        supabase
          .from("occurrences")
          .select("*", { count: "exact", head: true })
          .eq("shift_id", currentShiftId)
          .eq("requires_followup", true),
      ]);

      if (!active) return;
      setActiveOccurrencesCount(totalCount || 0);
      setActivePendingCount(pendingCount || 0);
    };

    void loadShiftCounters();

    return () => {
      active = false;
    };
  }, [openShift?.id]);

  useEffect(() => {
    let active = true;
    const currentShiftId = openShift?.id;

    const loadPositionLogsCount = async () => {
      if (!currentShiftId) {
        if (!active) return;
        setPositionLogsCount(0);
        return;
      }

      const { count } = await supabase
        .from("shift_position_logs")
        .select("*", { count: "exact", head: true })
        .eq("shift_id", currentShiftId);

      if (!active) return;
      setPositionLogsCount(count || 0);
    };

    void loadPositionLogsCount();

    return () => {
      active = false;
    };
  }, [openShift?.id]);

  useEffect(() => {
    let active = true;
    const currentShiftId = openShift?.id;

    const loadActivePositionLogs = async () => {
      if (!currentShiftId) {
        if (!active) return;
        setActivePositionLogs([]);
        return;
      }

      const { data: logsData } = await supabase
        .from("shift_position_logs")
        .select("id, user_id, entered_at_utc, left_at_utc, notes")
        .eq("shift_id", currentShiftId)
        .is("left_at_utc", null)
        .order("entered_at_utc", { ascending: true });

      if (!active) return;

      const rawLogs = logsData || [];
      if (rawLogs.length === 0) {
        setActivePositionLogs([]);
        return;
      }

      const userIds = [...new Set(rawLogs.map((item) => item.user_id).filter(Boolean))];
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (!active) return;

      const nameMap = new Map(
        (profileData || []).map((item) => [item.id, item.full_name || "CTA ativo"]),
      );

      setActivePositionLogs(
        rawLogs.map((item) => ({
          ...item,
          user_name: nameMap.get(item.user_id) || "CTA ativo",
        })),
      );
    };

    void loadActivePositionLogs();

    return () => {
      active = false;
    };
  }, [openShift?.id]);

  const hasOpenShift = !!openShift;
  const canCloseCurrentShift =
    !!openShift && !!profile && openShift.opened_by === profile.id;
  const canCreateOccurrence =
    !!openShift && !!profile && isUserInShiftComposition(openShift.opening_notes, profile);
  const isOpenShiftValidated = !!openShift?.validated_at_utc;
  const requiresValidationForClose = hasOpenShift && activeOccurrencesCount > 0;
  const operationalStatus = hasOpenShift ? "Turno aberto" : "Sem turno aberto";
  const sessionLine = [
    profile?.full_name || "—",
    profile?.role || "—",
    atsUnit?.name || "Sem órgão ATS",
    operationalStatus,
  ].join(" · ");

  const formatTimeOnly = (value?: string | null) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  };

  const formatRecentShiftMoment = (value?: string | null) => {
    if (!value) return "—";

    const date = new Date(value);
    const now = new Date();

    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isSameDay) {
      return formatTimeOnly(value);
    }

    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const quickAccessTurnActionLabel = hasOpenShift ? "Encerrar turno" : "Abrir turno";
  const quickAccessTurnActionDescription = hasOpenShift
    ? requiresValidationForClose && !isOpenShiftValidated
      ? "Disponível após a validação final do registo ATS."
      : canCloseCurrentShift
      ? "Encerrar o turno operacional ativo."
      : "Disponível apenas para quem abriu o turno."
    : "Iniciar um novo turno operacional.";
  const shiftComposition = useMemo(
    () => extractCompositionLines(openShift?.opening_notes),
    [openShift?.opening_notes],
  );
  const shiftSupervisorName =
    extractSupervisorName(openShift?.opening_notes) || openShiftOpenedByName;
  const currentUserShiftRole = extractUserShiftRole(openShift?.opening_notes, profile);
  const profileCardLabel = hasOpenShift && currentUserShiftRole ? "Função no turno" : "Perfil";
  const profileCardValue = currentUserShiftRole || profile?.role || "—";
  const canManagePositionLogs =
    !!profile &&
    !!openShift &&
    !!shiftSupervisorName &&
    ((profile.full_name?.trim().toLowerCase() || "") === shiftSupervisorName.toLowerCase() ||
      (profile.email?.trim().toLowerCase() || "") === shiftSupervisorName.toLowerCase());
  const hasAnyPositionLogs = positionLogsCount > 0;
  const hasActivePositionLogs = activePositionLogs.length > 0;
  const activePositionStatus = !hasOpenShift
    ? "Nenhum CTA ativo na posição operacional."
    : activePositionLogs.length === 0
    ? "Nenhum CTA ativo na posição operacional."
    : activePositionLogs
        .map((log) =>
          log.notes?.trim()
            ? `${log.user_name} na posição ${log.notes.trim()}`
            : `${log.user_name} em posição não indicada`,
        )
        .join(" · ");
  const primaryActionHref = !hasOpenShift
    ? "/shifts/open"
    : !hasAnyPositionLogs
    ? "/shifts/logs"
    : hasActivePositionLogs
    ? canCreateOccurrence
      ? "/occurrences/new"
      : canManagePositionLogs
      ? "/shifts/logs"
      : "/occurrences"
    : requiresValidationForClose && !isOpenShiftValidated
    ? `/occurrences/${openShift?.id ?? ""}`
    : canCloseCurrentShift
    ? "/shifts/close"
    : "/occurrences";
  const primaryActionLabel = !hasOpenShift
    ? "Abrir turno operacional"
    : !hasAnyPositionLogs
    ? canManagePositionLogs
      ? "Registar entrada na posição"
      : "Consultar logs operacionais"
    : hasActivePositionLogs
    ? canCreateOccurrence
      ? "Registar nova entrada"
      : canManagePositionLogs
      ? "Gerir logs operacionais"
      : "Consultar registos ATS"
    : requiresValidationForClose && !isOpenShiftValidated
    ? "Validar registo ATS"
    : canCloseCurrentShift
    ? "Encerrar turno"
    : "Consultar registos ATS";
  const primaryActionDescription = !hasOpenShift
    ? "Abra o turno para iniciar o registo operacional."
    : !hasAnyPositionLogs
    ? canManagePositionLogs
      ? "Registe a primeira entrada na posição operacional antes do restante fluxo do turno."
      : "Aguardar o supervisor para registar a entrada inicial na posição operacional."
    : hasActivePositionLogs
    ? canCreateOccurrence
      ? "Com a posição operacional ativa, já pode registar entradas de ocorrência no turno."
      : canManagePositionLogs
      ? "Existem posições operacionais ativas. Gere os logs de entrada e saída antes do encerramento."
      : "A operação está em curso. Consulte os registos ATS e acompanhe o estado do turno."
    : requiresValidationForClose && !isOpenShiftValidated
    ? "Os logs já foram encerrados. Valide agora o registo ATS antes de encerrar o turno."
    : canCloseCurrentShift
    ? "Os logs da posição já estão fechados e o turno pode ser encerrado."
    : "Os logs da posição estão fechados. A consulta dos registos ATS continua disponível.";
  const pendingItems = [
    {
      label:
        hasOpenShift && activeOccurrencesCount > 0 && !isOpenShiftValidated
          ? `${activeOccurrencesCount} ocorrência(s) por validar`
          : "Nenhuma ocorrência por validar",
      tone:
        hasOpenShift && activeOccurrencesCount > 0 && !isOpenShiftValidated
          ? "text-amber-500"
          : "text-emerald-500",
    },
    {
      label: hasOpenShift ? "Existe um turno em aberto" : "Nenhum turno em aberto",
      tone: hasOpenShift ? "text-amber-500" : "text-emerald-500",
    },
    {
      label:
        activePendingCount > 0
          ? `${activePendingCount} seguimento(s) pendente(s)`
          : "Nenhum seguimento pendente",
      tone: activePendingCount > 0 ? "text-amber-500" : "text-emerald-500",
    },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setMessage("");
    setNotice("");
    isLoggingOutRef.current = false;

    const { data: loginData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(
        getFriendlyErrorMessage("Não foi possível entrar na aplicação", error.message),
      );
      setLoginLoading(false);
      return;
    }

    await loadProfileAndShift(loginData.user.id, true);
    setLoginLoading(false);
    router.replace("/");
    router.refresh();
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage("Introduza primeiro o email da conta para receber o link de recuperação.");
      setNotice("");
      return;
    }

    setForgotPasswordLoading(true);
    setMessage("");
    setNotice("");

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/`,
    });

    if (error) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível enviar o email de recuperação",
          error.message,
        ),
      );
      setForgotPasswordLoading(false);
      return;
    }

    setNotice(
      "Se o email existir no sistema, enviámos um link para redefinir a palavra-passe.",
    );
    setNoticeTone("success");
    setForgotPasswordLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmNewPassword) {
      setMessage("Preencha os dois campos da nova palavra-passe.");
      setNotice("");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage("A confirmação da nova palavra-passe não coincide.");
      setNotice("");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("A nova palavra-passe deve ter pelo menos 6 caracteres.");
      setNotice("");
      return;
    }

    setRecoveryLoading(true);
    setMessage("");
    setNotice("");

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(
        getFriendlyErrorMessage(
          "Não foi possível atualizar a palavra-passe",
          error.message,
        ),
      );
      setRecoveryLoading(false);
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setIsPasswordRecoveryMode(false);
    setNewPassword("");
    setConfirmNewPassword("");
    setEmail("");
    setPassword("");
    setNotice("Palavra-passe atualizada com sucesso. Já pode entrar com a nova credencial.");
    setNoticeTone("success");
    setRecoveryLoading(false);
  };

  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    setLogoutLoading(true);
    setMessage("");
    setBooting(false);

    setProfile(null);
    setAtsUnit(null);
    setOpenShift(null);
    setEmail("");
    setPassword("");

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignora
    }

    window.location.replace("/");
  };

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="rounded-[0.9rem] border border-slate-200 bg-white px-6 py-4 shadow-sm">
          A carregar...
        </div>
      </main>
    );
  }

  if (profile && !isPasswordRecoveryMode) {
    return (
      <main className="min-h-screen bg-[#F8FAFB] text-slate-900">
        <div className="mx-auto max-w-7xl p-5 lg:p-7">
          <header className="overflow-hidden rounded-[1.05rem] border border-slate-200 bg-white shadow-[0_20px_40px_-34px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 px-6 py-5">
              <div>
                <Link href="/" className="inline-flex">
                  <Image
                    src="https://dtqajfxkhfarwqzuuepn.supabase.co/storage/v1/object/sign/occurrences-docs/logo_SIGO.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iZjJmYzNkZS1kZDQzLTQ5NGYtYjk1MS03NTcyMGZkYmVhYzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJvY2N1cnJlbmNlcy1kb2NzL2xvZ29fU0lHTy5wbmciLCJpYXQiOjE3NzczNjczNTYsImV4cCI6NDkzMDk2NzM1Nn0.o7Ti1qZ4mFm5pyiotc_Es9F7Gkeqp3dIOFs8BizkCb4"
                    alt="SIRO-ATS"
                    width={2048}
                    height={398}
                    className="h-12 w-auto object-contain"
                  />
                </Link>
              </div>

              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="inline-flex items-center justify-center gap-2 rounded-[0.8rem] border border-[#f28c28] bg-[#f28c28] px-4 py-2.5 text-[14px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#dd7818] hover:bg-[#dd7818] hover:shadow-[0_18px_30px_-18px_rgba(242,140,40,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28]/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogoutIcon />
                {logoutLoading ? "A sair..." : "Sair"}
              </button>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-3">
              <div className="inline-flex items-center gap-3 text-[#1d4f91]">
                <span className="flex h-9 w-9 items-center justify-center rounded-[0.8rem] bg-[#eef4fb]">
                  <HomeIcon />
                </span>
                <span className="text-[15px] font-semibold">Painel principal</span>
              </div>
            </div>
          </header>

          <div className="mt-6 space-y-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,2.45fr)_minmax(320px,0.95fr)]">
              <section className="rounded-[1rem] border border-slate-200 bg-white px-5 py-3.5 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1d4f91]">
                      Estado operacional
                    </p>
                    <h2
                      className={`mt-3 text-[2.05rem] font-semibold tracking-tight ${
                        hasOpenShift ? "text-emerald-800" : "text-amber-800"
                      }`}
                    >
                      {operationalStatus}
                    </h2>
                    <div className="mt-4 inline-flex items-center gap-2 text-[14px] text-slate-600">
                      <span className="flex h-[18px] w-[18px] items-center justify-center">
                        <UsersIcon />
                      </span>
                      <span>
                        {activePositionStatus}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`led-display led-display--status rounded-[0.8rem] border px-4 py-2 ${
                      hasOpenShift
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {hasOpenShift ? "Turno em curso" : "Sem registo ativo"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.82fr)_minmax(0,1.35fr)]">
                  <div className="flex items-center gap-4 rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <DashboardIconBox>
                      <GridIcon />
                    </DashboardIconBox>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Órgão ATS
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-slate-900">
                        {atsUnit?.name || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <DashboardIconBox>
                      <UserIcon />
                    </DashboardIconBox>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Utilizador
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-slate-900">
                        {profile.full_name || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <DashboardIconBox>
                      <ProfileBadgeIcon />
                    </DashboardIconBox>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {profileCardLabel}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-slate-900">
                        {profileCardValue}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <DashboardIconBox>
                      <UsersIcon />
                    </DashboardIconBox>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Supervisor do turno
                      </p>
                      <p className="mt-1 truncate text-[15px] font-semibold text-slate-900">
                        {hasOpenShift ? shiftSupervisorName : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[0.65rem] border border-slate-200 bg-white text-slate-600">
                      <UsersIcon />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Composição do turno
                    </p>
                  </div>
                  {hasOpenShift && shiftComposition.length ? (
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-slate-700">
                      {shiftComposition.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[14px] text-slate-500">
                      Sem composição registada.
                    </p>
                  )}
                </div>
              </section>

              <section className="flex flex-col rounded-[1rem] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1d4f91]">
                  Próxima ação
                </p>
                <p className="mt-5 max-w-sm text-[16px] leading-7 text-slate-600">
                  {primaryActionDescription}
                </p>

                <Link
                  href={primaryActionHref}
                  className={`${appButtonClass("primary")} relative translate-y-[7.5px] mt-auto inline-flex w-full items-center justify-center gap-3 pt-14 py-[14px] text-center text-[15px] hover:border-[#f28c28] hover:bg-[#f28c28] hover:shadow-[0_22px_38px_-18px_rgba(242,140,40,0.52)]`}
                >
                  <span className="relative -top-3 flex items-center justify-center gap-3">
                    <PlayTriangleIcon />
                    <span>{primaryActionLabel}</span>
                  </span>
                </Link>
              </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.225fr)_minmax(0,1.225fr)_minmax(320px,0.95fr)]">
              <section className="rounded-[1rem] border border-slate-200 bg-white px-6 py-5 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)] xl:col-span-3">
                <div className="flex items-center gap-3 text-[#1d4f91]">
                  <BoltIcon />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                    Acessos rápidos
                  </h3>
                </div>

                <div className="mt-5 flex flex-wrap gap-4 xl:flex-nowrap">
                  {hasOpenShift &&
                  (!canCloseCurrentShift ||
                    (requiresValidationForClose && !isOpenShiftValidated)) ? (
                    <QuickAccessCard
                      title={quickAccessTurnActionLabel}
                      description={quickAccessTurnActionDescription}
                      icon={<LogoutIcon />}
                      badge="Fechar"
                      locked
                      accent="slate"
                    />
                  ) : (
                    <QuickAccessCard
                      title={quickAccessTurnActionLabel}
                      description={quickAccessTurnActionDescription}
                      icon={hasOpenShift ? <LogoutIcon /> : <LoginIcon />}
                      badge={hasOpenShift ? "Fechar" : "Abrir"}
                      href={hasOpenShift ? "/shifts/close" : "/shifts/open"}
                      accent="orange"
                    />
                  )}

                  <QuickAccessCard
                    title="Registos ATS"
                    description="Consultar registos de ocorrências ATS."
                    icon={<FileIcon />}
                    badge="Abrir"
                    href="/occurrences"
                    accent="blue"
                  />

                  {hasOpenShift ? (
                    <QuickAccessCard
                      title="Logs operacionais"
                      description="Registar entrada e saída na posição operacional."
                      icon={<UsersIcon />}
                      badge="Abrir"
                      href="/shifts/logs"
                      accent="blue"
                    />
                  ) : (
                    <QuickAccessCard
                      title="Logs operacionais"
                      description="Disponível após abrir turno."
                      icon={<UsersIcon />}
                      badge="Abrir"
                      locked
                      accent="slate"
                    />
                  )}

                  <QuickAccessCard
                    title="Relatórios"
                    description="Aceder a relatórios e estatísticas."
                    icon={<ChartIcon />}
                    badge="Abrir"
                    locked
                    accent="slate"
                  />
                </div>
              </section>

              <section className="rounded-[1rem] border border-slate-200 bg-white px-6 py-5 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)]">
                <div className="flex items-center gap-3 text-[#1d4f91]">
                  <ChartIcon />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                    Resumo de hoje
                  </h3>
                </div>

                <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[0.9rem] border border-slate-200 bg-slate-50/45 md:grid-cols-4">
                  {[
                    {
                      id: "open-shifts",
                      value: hasOpenShift ? "1" : "0",
                      label: (
                        <>
                          Turnos
                          <br />
                          abertos
                        </>
                      ),
                      icon: <CalendarIcon />,
                      tone: "text-[#1d4f91]",
                    },
                    {
                      id: "occurrences",
                      value: String(activeOccurrencesCount),
                      label: "Ocorrências registadas",
                      icon: <FileIcon />,
                      tone: "text-[#1d4f91]",
                    },
                    {
                      id: "pending",
                      value: String(activePendingCount),
                      label: "Pendências",
                      icon: <ClipboardIcon />,
                      tone: "text-[#f28c28]",
                    },
                    {
                      id: "last-update",
                      value: formatTimeOnly(lastClosedShift?.end_time_utc),
                      label: (
                        <>
                          Última
                          <br />
                          atualização
                        </>
                      ),
                      icon: <ClockIcon />,
                      tone: "text-[#1d4f91]",
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col items-center px-3.5 py-3 text-center first:border-l-0 md:border-l md:border-slate-200"
                    >
                      <div
                        className={`mx-auto flex h-9 w-9 items-center justify-center ${item.tone} [&>svg]:h-6.5 [&>svg]:w-6.5`}
                      >
                        {item.icon}
                      </div>
                      <p className="digital-number mt-3 flex min-h-[40px] w-full items-center justify-center text-center text-[1.15rem] text-slate-900">
                        {item.value}
                      </p>
                      <p className="mt-0.5 w-[7.75rem] text-center text-[11.5px] leading-[1.35] text-slate-600">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1rem] border border-slate-200 bg-white px-5 py-3.5 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)]">
                <div className="flex items-center gap-3 text-[#f28c28]">
                  <ClipboardIcon />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                    Controlo operacional
                  </h3>
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  {pendingItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-3 py-2 text-[14px] text-slate-700">
                      <span className={item.tone}>
                        <CheckCircleIcon />
                      </span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1rem] border border-slate-200 bg-white px-5 py-3.5 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)]">
                <div className="flex items-center gap-3 text-[#1d4f91]">
                  <GearIcon />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                    Sistema
                  </h3>
                </div>

                <div className="mt-3 overflow-hidden rounded-[0.9rem] border border-slate-200 bg-slate-50/45">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-3 text-[14px] text-slate-700">
                      <SystemDot />
                      <span>Estado do sistema</span>
                    </div>
                    <span className="font-medium text-emerald-600">Operacional</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
                    <div className="flex items-center gap-3 text-[14px] text-slate-700">
                      <SystemDot />
                      <span>Base de dados</span>
                    </div>
                    <span className="font-medium text-emerald-600">Sincronizada</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
                    <div className="flex items-center gap-3 text-[14px] text-slate-700">
                      <ClockIcon />
                      <span>Último fecho de turno</span>
                    </div>
                    <span className="font-medium text-slate-800">
                      {formatRecentShiftMoment(lastClosedShift?.end_time_utc)}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[0.8rem] border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)]">
              {sessionLine}
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-[#f7fbff] bg-cover bg-center bg-no-repeat text-slate-900"
      style={{
        backgroundImage:
          'url("https://dtqajfxkhfarwqzuuepn.supabase.co/storage/v1/object/sign/occurrences-docs/fundo_login.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iZjJmYzNkZS1kZDQzLTQ5NGYtYjk1MS03NTcyMGZkYmVhYzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJvY2N1cnJlbmNlcy1kb2NzL2Z1bmRvX2xvZ2luLnBuZyIsImlhdCI6MTc3NzEwNTEzNSwiZXhwIjo0OTMwNzA1MTM1fQ.Id1a8DIXSqJ8O3AQOsaund-sY4yfRp4kgiuEbq6Cf9A")',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_rgba(247,251,255,0.2)_42%,_rgba(247,251,255,0.26)_100%)]" />

      <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
        <section className="mx-auto w-full max-w-[510px] rounded-[18px] border border-white/80 bg-white/94 px-[26px] py-[28px] shadow-[0_26px_70px_-34px_rgba(15,23,42,0.26)] ring-1 ring-white/80 backdrop-blur sm:px-[34px] sm:py-[32px]">
          <div className="space-y-5">
            <div className="text-center">
              <Link href="/" className="inline-flex">
                <Image
                  src="https://dtqajfxkhfarwqzuuepn.supabase.co/storage/v1/object/sign/occurrences-docs/logo_SIGO.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iZjJmYzNkZS1kZDQzLTQ5NGYtYjk1MS03NTcyMGZkYmVhYzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJvY2N1cnJlbmNlcy1kb2NzL2xvZ29fU0lHTy5wbmciLCJpYXQiOjE3NzczNjczNTYsImV4cCI6NDkzMDk2NzM1Nn0.o7Ti1qZ4mFm5pyiotc_Es9F7Gkeqp3dIOFs8BizkCb4"
                  alt="SIRO-ATS"
                  width={2048}
                  height={398}
                  className="h-12 w-auto object-contain sm:h-14"
                />
              </Link>
              <div className="mx-auto mt-5 flex max-w-[34rem] items-center gap-0">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="h-[2px] w-14 rounded-full bg-[#f28c28]" />
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>

            <div className="flex items-center justify-center text-center text-slate-700">
              <p className="text-[11px] font-medium leading-4 sm:text-[12px]">
                Acesso à plataforma de registo e gestão de ocorrências ATS
              </p>
            </div>

            <form
              onSubmit={isPasswordRecoveryMode ? handleUpdatePassword : handleLogin}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-slate-200 bg-white py-3 pl-12 pr-4 text-[15px] text-slate-900 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] outline-none transition placeholder:text-slate-400 focus:border-[#cfddeb] focus:ring-2 focus:ring-[#1d4f91]/10"
                    placeholder="ex.: nome@dominio.com"
                    required
                    disabled={isPasswordRecoveryMode}
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <EnvelopeIcon />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  {isPasswordRecoveryMode ? "Nova palavra-passe" : "Palavra-passe"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={isPasswordRecoveryMode ? newPassword : password}
                    onChange={(e) =>
                      isPasswordRecoveryMode
                        ? setNewPassword(e.target.value)
                        : setPassword(e.target.value)
                    }
                    className="w-full rounded-[0.75rem] border border-slate-200 bg-white py-3 pl-12 pr-12 text-[15px] text-slate-900 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] outline-none transition placeholder:text-slate-400 focus:border-[#cfddeb] focus:ring-2 focus:ring-[#1d4f91]/10"
                    placeholder={
                      isPasswordRecoveryMode
                        ? "Introduza a nova palavra-passe"
                        : "Introduza a sua palavra-passe"
                    }
                    required
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <LockIcon />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-[#1d4f91]"
                    aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {isPasswordRecoveryMode ? (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Confirmar nova palavra-passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full rounded-[0.75rem] border border-slate-200 bg-white py-3 pl-12 pr-12 text-[15px] text-slate-900 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] outline-none transition placeholder:text-slate-400 focus:border-[#cfddeb] focus:ring-2 focus:ring-[#1d4f91]/10"
                        placeholder="Confirme a nova palavra-passe"
                        required
                      />
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <LockIcon />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotPasswordLoading}
                      className="font-medium text-[#1d4f91] transition hover:text-[#163d70] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ fontSize: "11px", lineHeight: "1.2" }}
                    >
                      {forgotPasswordLoading
                        ? "A enviar..."
                        : "Esqueceu-se da palavra-passe?"}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isPasswordRecoveryMode ? recoveryLoading : loginLoading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-[0.8rem] border border-[#1d4f91] bg-[#1d4f91] px-5 py-3.5 text-[1rem] font-semibold text-white shadow-[0_18px_34px_-18px_rgba(29,79,145,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-[#f28c28] hover:bg-[#f28c28] hover:shadow-[0_20px_38px_-18px_rgba(242,140,40,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a67ba]/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  {isPasswordRecoveryMode
                    ? recoveryLoading
                      ? "A atualizar..."
                      : "Atualizar palavra-passe"
                    : loginLoading
                      ? "A entrar..."
                      : "Entrar"}
                </span>
                <ArrowRightIcon />
              </button>

              <div className="pt-1">
                <div className="h-px w-full bg-slate-200" />
              </div>

              <div className="flex items-center justify-center pt-1">
                <Image
                  src="/asa_color.png"
                  alt="ASA"
                  width={420}
                  height={128}
                  className="h-11 w-auto object-contain sm:h-12"
                />
              </div>
            </form>

            {notice && (
              <div
                className={`rounded-[0.8rem] border px-4 py-4 text-sm ${
                  noticeTone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {notice}
              </div>
            )}

            {message && (
              <div className="rounded-[0.8rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                {message}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
