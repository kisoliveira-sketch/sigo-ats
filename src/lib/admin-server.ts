import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type AdminProfile = {
  id: string;
  role: string;
  full_name: string | null;
  ats_unit_id: number | null;
};

export function getAdminSupabaseClients() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    adminClient: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function getAuthorizedAdminContext(
  request: NextRequest,
  allowedRoles: string[],
): Promise<
  | {
      adminClient: SupabaseClient;
      profile: AdminProfile;
    }
  | {
      error: {
        status: number;
        message: string;
      };
    }
> {
  const clients = getAdminSupabaseClients();

  if (!clients) {
    return {
      error: {
        status: 500,
        message: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.",
      },
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: {
        status: 401,
        message: "Sessão inválida.",
      },
    };
  }

  const { data: userData, error: userError } = await clients.authClient.auth.getUser(
    token,
  );

  if (userError || !userData.user) {
    return {
      error: {
        status: 401,
        message: "Não foi possível validar a sessão.",
      },
    };
  }

  const { data: profile, error: profileError } = await clients.adminClient
    .from("profiles")
    .select("id, role, full_name, ats_unit_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: {
        status: 403,
        message: "Perfil não encontrado.",
      },
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      error: {
        status: 403,
        message: "Sem permissão para administração.",
      },
    };
  }

  return {
    adminClient: clients.adminClient,
    profile: profile as AdminProfile,
  };
}
