import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const appLineIconClass =
  "h-5 w-5 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]";

export function appButtonClass(
  variant: "primary" | "secondary" | "danger" = "secondary",
  size: "xs" | "sm" | "md" = "md",
) {
  const sizeClass =
    size === "xs"
      ? "rounded-[0.65rem] px-3 py-1.5 text-[12px]"
      : size === "sm"
      ? "rounded-[0.72rem] px-3.5 py-2 text-[13px]"
      : "rounded-[0.75rem] px-4 py-2.5 text-[13px]";

  const base =
    `inline-flex items-center justify-center ${sizeClass} font-semibold no-underline transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50`;

  if (variant === "primary") {
    return `${base} border border-[#1d4f91] bg-[#1d4f91] !text-white visited:!text-white hover:-translate-y-0.5 hover:!text-white hover:border-[#163d70] hover:bg-[#163d70] hover:shadow-[0_18px_30px_-18px_rgba(22,61,112,0.78)] focus-visible:ring-[#2a67ba]/35 shadow-[0_14px_24px_-18px_rgba(29,79,145,0.62)]`;
  }

  if (variant === "danger") {
    return `${base} border border-red-600 bg-red-600 !text-white visited:!text-white hover:-translate-y-0.5 hover:!text-white hover:border-red-700 hover:bg-red-700 hover:shadow-[0_18px_30px_-18px_rgba(185,28,28,0.68)] focus-visible:ring-red-300/60 shadow-[0_14px_24px_-18px_rgba(220,38,38,0.5)]`;
  }

  return `${base} border border-[#1d4f91] bg-[#1d4f91] !text-white visited:!text-white hover:-translate-y-0.5 hover:!text-white hover:border-[#2a67ba] hover:bg-[#2a67ba] hover:shadow-[0_16px_28px_-18px_rgba(42,103,186,0.72)] focus-visible:ring-[#2a67ba]/35 shadow-[0_12px_22px_-18px_rgba(29,79,145,0.56)]`;
}

export function heroActionClass(variant: "primary" | "secondary" = "secondary") {
  const base =
    "inline-flex items-center justify-center rounded-[0.72rem] px-3.5 py-2 text-[13px] font-semibold no-underline transition duration-200 focus-visible:outline-none focus-visible:ring-2";

  if (variant === "primary") {
    return `${base} border border-[#1d4f91] bg-[#1d4f91] !text-white visited:!text-white shadow-[0_12px_22px_-18px_rgba(29,79,145,0.56)] hover:-translate-y-1 hover:scale-[1.02] hover:border-[#f28c28] hover:bg-[#f28c28] hover:!text-white hover:shadow-[0_22px_38px_-18px_rgba(242,140,40,0.52)] focus-visible:ring-[#f28c28]/35`;
  }

  return `${base} border border-[#1d4f91] bg-[#1d4f91] !text-white visited:!text-white shadow-[0_12px_22px_-18px_rgba(29,79,145,0.56)] hover:-translate-y-1 hover:scale-[1.02] hover:border-[#f28c28] hover:bg-[#f28c28] hover:!text-white hover:shadow-[0_22px_38px_-18px_rgba(242,140,40,0.52)] focus-visible:ring-[#f28c28]/35`;
}

export function appIconButtonClass() {
  return "inline-flex h-10 w-10 items-center justify-center rounded-[0.75rem] border border-[#1d4f91] bg-[#1d4f91] text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#2a67ba] hover:bg-[#2a67ba] hover:text-white hover:shadow-[0_16px_28px_-18px_rgba(42,103,186,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a67ba]/35";
}

export function appFieldClass(hasLeadingIcon = false) {
  const padding = hasLeadingIcon ? "pl-12 pr-4" : "px-4";

  return `w-full rounded-[0.68rem] border border-slate-300/90 bg-white/95 ${padding} py-2.5 text-sm text-slate-900 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.2)] outline-none transition placeholder:text-slate-400 focus:border-[#2a67ba] focus:ring-2 focus:ring-[#2a67ba]/12 disabled:bg-slate-100/80 disabled:text-slate-500 disabled:shadow-none`;
}

export function appSelectClass() {
  return `${appFieldClass()} appearance-none pr-11`;
}

export function appTextareaClass() {
  return `${appFieldClass()} min-h-[7.5rem] resize-y leading-6`;
}

export function appCheckboxClass() {
  return "mt-0.5 h-4 w-4 rounded border border-slate-300/90 bg-white text-[#1d4f91] shadow-[0_8px_18px_-16px_rgba(15,23,42,0.22)] focus:ring-2 focus:ring-[#2a67ba]/20";
}

export function appLabelClass() {
  return "mb-1.5 block text-[13px] font-semibold tracking-[0.01em] text-slate-600";
}

export function appStickyBarClass() {
  return "sticky bottom-4 flex flex-col gap-3 rounded-[0.8rem] border border-slate-200 bg-white/92 p-3.5 shadow-[0_22px_40px_-28px_rgba(15,23,42,0.3)] backdrop-blur md:flex-row md:items-center md:justify-between";
}

export function SelectField({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${appSelectClass()} ${className}`.trim()}>
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
        >
          <path d="m5 7 5 6 5-6" />
        </svg>
      </div>
    </div>
  );
}

export function SoftIcon({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "orange" | "blue" | "slate" | "emerald" | "amber" | "violet" | "red";
}) {
  const tones: Record<string, string> = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    blue: "border-blue-200 bg-[#eef4fb] text-blue-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-[0.8rem] border ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  icon,
  title,
  subtitle,
  titleTooltip,
  children,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  titleTooltip?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-[1rem] border border-slate-200/90 bg-white/95 shadow-[0_22px_50px_-28px_rgba(15,23,42,0.25)] ring-1 ring-white/70 backdrop-blur ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className={`flex items-start gap-4 ${compact ? "mb-3" : "mb-5"}`}>
        {icon}
        <div>
          <div className="group/tooltip relative inline-block">
            <h2
              className={`cursor-help font-semibold tracking-tight text-slate-950 ${
                compact ? "text-[17px]" : "text-lg"
              }`}
            >
              {title}
            </h2>
            {titleTooltip && (
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-[0.72rem] border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-slate-600 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)] group-hover/tooltip:block">
                {titleTooltip}
              </div>
            )}
          </div>
          {subtitle && (
            <p
              className={`max-w-2xl text-sm text-slate-600 ${
                compact ? "mt-0.5 leading-5" : "mt-1 leading-6"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SlimStatCard({
  icon,
  label,
  value,
  noWrap = false,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  noWrap?: boolean;
}) {
  return (
    <div className="rounded-[0.8rem] border border-slate-200/90 bg-white/90 px-4 py-4 shadow-[0_18px_35px_-30px_rgba(15,23,42,0.35)] ring-1 ring-white/70 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0">
          <p
            className={`text-[11px] uppercase tracking-wide text-slate-500 ${
              noWrap ? "whitespace-nowrap" : ""
            }`}
          >
            {label}
          </p>
          <div
            className={`mt-1 text-sm font-bold leading-5 text-slate-900 ${
              noWrap
                ? "overflow-hidden whitespace-nowrap text-ellipsis"
                : "break-all"
            }`}
            title={typeof value === "string" ? value : undefined}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActionTile({
  href,
  title,
  description,
  tone,
  disabled = false,
  compact = false,
}: {
  href?: string;
  title: string;
  description: string;
  tone: "blue" | "orange" | "slate" | "emerald";
  disabled?: boolean;
  compact?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    blue: "border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-sky-50 hover:border-blue-300 hover:shadow-[0_18px_40px_-26px_rgba(37,99,235,0.45)]",
    orange:
      "border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 hover:border-orange-300 hover:shadow-[0_18px_40px_-26px_rgba(234,88,12,0.45)]",
    slate:
      "border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100 hover:border-slate-300 hover:shadow-[0_18px_40px_-26px_rgba(51,65,85,0.35)]",
    emerald:
      "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 hover:border-emerald-300 hover:shadow-[0_18px_40px_-26px_rgba(5,150,105,0.4)]",
  };

  if (disabled || !href) {
    return (
      <div
        className={`rounded-[0.8rem] border border-slate-200 bg-slate-50/90 opacity-75 ${
          compact ? "p-3.5" : "p-5"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={`${compact ? "text-[15px]" : "text-base"} font-semibold text-slate-900`}>
            {title}
          </p>
          <span
            className={`rounded-[0.6rem] border border-slate-200 bg-white font-medium uppercase tracking-wide text-slate-500 ${
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
            }`}
          >
            Bloqueado
          </span>
        </div>
        <p className={`text-sm text-slate-600 ${compact ? "mt-2 leading-5" : "mt-3 leading-6"}`}>
          {description}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col rounded-[0.8rem] border transition duration-200 hover:-translate-y-0.5 ${
        compact ? "p-3.5" : "p-5"
      } ${toneClasses[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`${compact ? "text-[15px]" : "text-base"} font-semibold text-slate-950`}>
          {title}
        </p>
        <span
          className={`rounded-[0.6rem] border border-white/80 bg-white/80 font-medium uppercase tracking-wide text-slate-500 transition group-hover:text-slate-700 ${
            compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
          }`}
        >
          Abrir
        </span>
      </div>
      <p className={`text-sm text-slate-600 ${compact ? "mt-2 leading-5" : "mt-3 leading-6"}`}>
        {description}
      </p>
    </Link>
  );
}

export function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`px-1 py-2 ${className}`.trim()}>
      <div className="flex flex-col items-center justify-center gap-1 text-center sm:flex-row sm:gap-1.5 sm:text-left">
        <Image
          src="/kzo-logo.svg"
          alt="KZO - Design & Comunicação"
          width={260}
          height={84}
          className="h-14 w-auto object-contain sm:h-16"
        />
        <p className="text-[12px] leading-5 text-slate-500 sm:-ml-1">
          © KZO - Design & Comunicação 2026 - todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

export function PageShell({
  badge,
  title,
  subtitle,
  heroIcon,
  actions,
  compact = false,
  heroThin = false,
  heroTighter = false,
  children,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  heroIcon?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  heroThin?: boolean;
  heroTighter?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="app-atc-background relative min-h-screen text-slate-900">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <div className={`overflow-hidden rounded-[1.05rem] border border-slate-200/80 bg-white/96 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.22)] ring-1 ring-white/80 ${compact ? "mb-6" : "mb-8"}`}>
          <div className={`flex items-start justify-between gap-4 ${
            heroTighter
              ? "px-4 py-3.5"
              : heroThin
              ? "px-5 py-4"
              : compact
              ? "px-6 py-5"
              : "px-6 py-6"
          }`}>
            <div>
              <Link href="/" className="inline-flex">
                <Image
                  src="https://dtqajfxkhfarwqzuuepn.supabase.co/storage/v1/object/sign/occurrences-docs/logo_SIGO.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iZjJmYzNkZS1kZDQzLTQ5NGYtYjk1MS03NTcyMGZkYmVhYzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJvY2N1cnJlbmNlcy1kb2NzL2xvZ29fU0lHTy5wbmciLCJpYXQiOjE3NzczNjczNTYsImV4cCI6NDkzMDk2NzM1Nn0.o7Ti1qZ4mFm5pyiotc_Es9F7Gkeqp3dIOFs8BizkCb4"
                  alt="SIRO-ATS"
                  width={2048}
                  height={398}
                  className={
                    heroTighter
                      ? "h-11 w-auto object-contain sm:h-12"
                      : heroThin
                      ? "h-11 w-auto object-contain sm:h-12"
                      : compact
                      ? "h-11 w-auto object-contain sm:h-12"
                      : "h-11 w-auto object-contain sm:h-[3.25rem]"
                  }
                />
              </Link>
            </div>

            {actions && (
              <div className={`relative z-10 flex flex-wrap ${compact ? "gap-2" : "gap-3"}`}>{actions}</div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-3">
            <div className="inline-flex items-center gap-3 text-[#1d4f91]">
              <span className="flex h-9 w-9 items-center justify-center rounded-[0.8rem] bg-[#eef4fb]">
                {heroIcon ?? <HomeIcon />}
              </span>
              <div>
                <h1 className="text-[15px] font-semibold">{title || badge}</h1>
                {subtitle ? <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p> : null}
              </div>
            </div>
          </div>
        </div>

        {children}

        <AppFooter className="mt-3" />
      </div>
    </main>
  );
}

export function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function HashIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a3 3 0 0 1 0 5.74" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
    </svg>
  );
}

export function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H4" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="m14 7-5 5 5 5" />
      <path d="M9 12h11" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={appLineIconClass} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}
