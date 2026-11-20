"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ShiftAuthority = {
  verified: boolean;
  managerKind: "supervisor" | "opener" | "none";
  managerLabel: string | null;
  canManagePositions: boolean;
  canCreateOccurrence: boolean;
  memberRole: string | null;
  memberIds: string[];
};

function readAuthority(data: unknown): ShiftAuthority | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.verified !== true ||
      !["supervisor", "opener", "none"].includes(String(row.managerKind)) ||
      !Array.isArray(row.memberIds) ||
      !row.memberIds.every((id) => typeof id === "string")) return null;
  return {
    verified: true,
    managerKind: row.managerKind as ShiftAuthority["managerKind"],
    managerLabel: typeof row.managerLabel === "string" ? row.managerLabel : null,
    canManagePositions: row.canManagePositions === true,
    canCreateOccurrence: row.canCreateOccurrence === true,
    memberRole: typeof row.memberRole === "string" ? row.memberRole : null,
    memberIds: row.memberIds,
  };
}

export function useShiftAuthority(shiftId?: number | null, actorId?: string | null) {
  const [result, setResult] = useState<{
    shiftId: number;
    actorId: string;
    value: ShiftAuthority | null;
  } | null>(null);

  useEffect(() => {
    if (!shiftId || !actorId) return;
    let active = true;
    void (async () => {
      let value: ShiftAuthority | null = null;
      try {
        const { data, error } = await supabase.rpc("sigo_shift_permissions_v1", { p_shift_id: shiftId });
        if (!error) value = readAuthority(data);
      } catch {
        // Permission checks fail closed in the UI as well as in the database.
      }
      if (active) setResult({ shiftId, actorId, value });
    })();
    return () => { active = false; };
  }, [shiftId, actorId]);

  const current = result?.shiftId === shiftId && result?.actorId === actorId ? result : null;
  return { authority: current?.value ?? null, pending: !!shiftId && !!actorId && !current };
}
