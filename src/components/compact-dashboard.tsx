"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChevronRight, CircleCheck, CircleHelp, CircleMinus, ClipboardList, Clock3, FileText,
  History, LayoutGrid, LockKeyhole, LogIn, LogOut, Plus, RefreshCw, Settings2, TriangleAlert, UserRound,
  UsersRound, type LucideIcon,
} from "lucide-react";
import { AppFooter } from "@/components/siro-ui";
import styles from "./compact-dashboard.module.css";

type Theme = "light" | "dark" | "system";
type Time = "utc" | "local";
type ShiftStatus = "known" | "checking" | "unavailable";
type PrimaryAction = {
  kind: "refresh" | "open" | "firstPosition" | "newOccurrence" | "managePositions" | "validate" | "close" | "history";
  href: string | null;
  label: string;
  description: string;
};
type SecondaryAction = { label: string; href: string | null; reason: string | null };

type CompactDashboardProps = {
  unitName: string | null;
  userName: string;
  profileLabel: string;
  profileValue: string;
  managerLabel: string;
  managerName: string;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  time: Time;
  onTime: (time: Time) => void;
  onLogout: () => void;
  logoutLoading: boolean;
  canAccessAdmin: boolean;
  lastEvent: { top: string; bottom: string };
  shiftStatus: ShiftStatus;
  shiftReference: string | null;
  shiftStartLabel: string;
  shiftId: number | null;
  operationalStatus: string;
  hasOpenShift: boolean;
  activePositionStatus: string;
  activePositionCount: number | null;
  occurrenceCount: number | null;
  followupCount: number | null;
  pending: ReadonlyArray<{ label: string; attention: boolean }>;
  composition: readonly string[];
  primary: PrimaryAction;
  turn: SecondaryAction;
  canViewCloseRequirements: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
};

const actions: Record<PrimaryAction["kind"], LucideIcon> = {
  refresh: RefreshCw,
  open: LogIn,
  firstPosition: UsersRound,
  newOccurrence: Plus,
  managePositions: UsersRound,
  validate: FileText,
  close: LogOut,
  history: History,
};

function NavRow({
  icon: Icon, title, description, href, selected = false,
}: { icon: LucideIcon; title: string; description?: ReactNode; href?: string | null; selected?: boolean }) {
  const body = <>
    <span className={styles.tile}><Icon size={20} aria-hidden="true" /></span>
    <span className={styles.rowWords}><strong>{title}</strong>{description && <small>{description}</small>}</span>
    {href ? <ChevronRight size={16} aria-hidden="true" /> : !selected ? <LockKeyhole size={16} aria-hidden="true" /> : null}
  </>;
  return href
    ? <Link className={styles.row} href={href} prefetch={false}>{body}</Link>
    : <div className={styles.row}>{body}</div>;
}

function Disclosure({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <details className={`${styles.card} ${styles.disclosure}`}>
      <summary>
        <span><Icon size={20} aria-hidden="true" />{title}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}

export function CompactDashboard({
  unitName, userName, profileLabel, profileValue, managerLabel, managerName, theme, onTheme, time, onTime,
  onLogout, logoutLoading, canAccessAdmin, lastEvent, shiftStatus, shiftReference, shiftStartLabel, shiftId,
  operationalStatus, hasOpenShift, activePositionStatus, activePositionCount, occurrenceCount, followupCount,
  pending, composition, primary, turn, canViewCloseRequirements, canRefresh, onRefresh,
}: CompactDashboardProps) {
  const shiftKnown = shiftStatus === "known" && hasOpenShift && shiftId !== null;
  const noShift = shiftStatus === "known" && !hasOpenShift;
  const isRefreshing = shiftStatus === "checking";
  const tone = shiftStatus !== "known" ? "unknown" : !shiftKnown ? "neutral" : turn.reason ? "attention" : "open";
  const StatusIcon = shiftStatus === "unavailable" || tone === "attention" ? TriangleAlert
    : isRefreshing ? Clock3 : shiftKnown ? CircleCheck : CircleMinus;
  const ActionIcon = actions[primary.kind];
  const timeZoneLabel = time === "utc" ? "UTC" : "Local";
  const unavailableReason = noShift ? "Requer um turno aberto" : "Estado do turno por confirmar";
  const mainActionDuplicate = primary.href;
  const historyIsPrimary = mainActionDuplicate === "/occurrences";
  const logsIsPrimary = mainActionDuplicate === "/shifts/logs";
  const reportIsPrimary = shiftKnown && mainActionDuplicate === "/occurrences/" + shiftId;

  return (
    <div className={styles.compact} data-compact-dashboard="">
      <header className={styles.mast}>
        <div className={`${styles.frame} ${styles.mastContent}`}>
          <Link className={styles.brand} href="/" aria-label="SIGO-ATS, painel principal" prefetch={false}>
            <Image src="/icon.png" alt="" width={30} height={30} />
            <span>SIGO-ATS</span>
          </Link>
          <div className={styles.mastControls}>
            <span className={styles.zone}><Clock3 size={16} aria-hidden="true" />{timeZoneLabel}</span>
            <Link href="/help" prefetch={false} className={styles.iconControl} aria-label="Ajuda"><CircleHelp size={20} aria-hidden="true" /></Link>
            <button type="button" className={styles.iconControl} onClick={onLogout} disabled={logoutLoading}
              aria-label={logoutLoading ? "A sair" : "Sair"}><LogOut size={20} aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <div className={`${styles.frame} ${styles.content}`}>
        <div className={styles.title}>
          <div>
            <p className={styles.eyebrow}>Operação ATS</p>
            <h1>Painel principal</h1>
          </div>
          <span className={styles.unit}>{unitName || "Sem órgão ATS"}</span>
        </div>

        <div className={styles.grid}>
          <div className={styles.stack}>
            <section className={`${styles.card} ${styles.hero}`} data-state={tone} aria-label="Estado operacional e próxima ação">
              <span className={styles.badge} role="status"><StatusIcon size={16} aria-hidden="true" />{operationalStatus}</span>
              <h2>{shiftKnown ? turn.reason ? "Fecho condicionado" : "Turno em curso" : noShift ? "Preparar o turno" : "Estado por confirmar"}</h2>
              {shiftKnown && <p className={styles.reference}>{shiftReference || "—"}{shiftStartLabel !== "—" ? ` · Início ${shiftStartLabel} ${timeZoneLabel}` : ""}</p>}
              <div className={styles.actionBlock}>
                {primary.href ? (
                  <Link className={styles.primary} href={primary.href} prefetch={false} data-dashboard-primary="">
                    <ActionIcon size={20} aria-hidden="true" />{primary.label}
                  </Link>
                ) : (
                  <button type="button" className={styles.primary} onClick={onRefresh} disabled={!canRefresh || isRefreshing}
                    data-dashboard-primary="" aria-busy={isRefreshing}>
                    <ActionIcon size={20} aria-hidden="true" />{isRefreshing ? "A verificar…" : primary.label}
                  </button>
                )}
                <p className={styles.hint}>{primary.description}</p>
              </div>
              {shiftKnown && turn.reason && (
                <p className={styles.reason}><LockKeyhole size={16} aria-hidden="true" /><span>{turn.reason}</span></p>
              )}
              {shiftKnown && <dl className={styles.metrics}>
                <div><dt>Em posição</dt><dd>{activePositionCount ?? "—"}</dd></div>
                <div><dt>Ocorrências registadas</dt><dd>{occurrenceCount ?? "—"}</dd></div>
                <div><dt>Seguimentos pendentes</dt><dd>{followupCount ?? "—"}</dd></div>
              </dl>}
            </section>

            <Disclosure icon={ClipboardList} title="Controlo operacional">
              <ul className={styles.controlList}>
                {pending.map(({ label, attention }) => <li key={label}>{attention
                  ? <TriangleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}<span>{label}</span></li>)}
              </ul>
              <p className={styles.lastEvent}><Clock3 size={16} aria-hidden="true" /><span>
                Último evento ({timeZoneLabel}): {lastEvent.top}{lastEvent.bottom ? " · " + lastEvent.bottom : ""}
              </span></p>
            </Disclosure>
          </div>

          <div className={styles.stack}>
            <section className={styles.card} aria-label="Consultar">
              <h2 className={styles.smallTitle}>Consultar</h2>
              <p className={styles.hint}>Turno atual e registos anteriores.</p>
              <NavRow icon={History} title="Histórico" href={historyIsPrimary ? null : "/occurrences"} selected={historyIsPrimary}
                description={historyIsPrimary ? "Disponível no botão principal" : "Consultar turnos anteriores"} />
              <NavRow icon={FileText} title="Relatório do turno atual"
                href={shiftKnown && !reportIsPrimary ? "/occurrences/" + shiftId : null} selected={!!reportIsPrimary}
                description={shiftKnown ? reportIsPrimary ? "Disponível no botão de validação" : "Ocorrências e validação do turno" : unavailableReason} />
              <NavRow icon={UsersRound} title="Logs operacionais" href={shiftKnown && !logsIsPrimary ? "/shifts/logs" : null} selected={logsIsPrimary}
                description={shiftKnown ? logsIsPrimary ? "Disponível no botão principal" : "Consultar posições do turno" : unavailableReason} />
              {turn.href && turn.href !== mainActionDuplicate && <NavRow icon={shiftKnown ? LogOut : LogIn} title={turn.label} href={turn.href} />}
              {shiftKnown && canViewCloseRequirements && <NavRow icon={LockKeyhole} title="Ver requisitos de fecho" href="/shifts/close" />}
              {canAccessAdmin && <NavRow icon={LayoutGrid} title="Administração" href="/admin" />}
            </section>

            {shiftKnown && <Disclosure icon={UsersRound} title="Equipa e posições do turno">
              <p><strong>{managerLabel}</strong><br />{managerName}</p>
              <p>{activePositionStatus}</p>
              {composition.length ? <ul>{composition.map((line, i) => <li key={i}>{line}</li>)}</ul> : <p>Sem composição registada.</p>}
            </Disclosure>}

            <Disclosure icon={Settings2} title="Conta e preferências">
              <p className={styles.account}><UserRound size={16} aria-hidden="true" /><span><strong>{userName}</strong><br />{profileLabel}: {profileValue}</span></p>
              <label className={styles.preference}>Tema visual
                <select value={theme} onChange={(event) => onTheme(event.target.value as Theme)}>
                  <option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option>
                </select>
              </label>
              <label className={styles.preference}>Hora operacional
                <select value={time} onChange={(event) => onTime(event.target.value as Time)}>
                  <option value="utc">UTC</option><option value="local">Local</option>
                </select>
              </label>
            </Disclosure>
          </div>
        </div>

        <div className={styles.footer}><AppFooter /></div>
      </div>
    </div>
  );
}
