import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedAdminContext } from "@/lib/admin-server";

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedAdminContext(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const atsUnitId =
      typeof body.atsUnitId === "number"
        ? body.atsUnitId
        : typeof body.atsUnitId === "string" && body.atsUnitId.trim()
          ? Number(body.atsUnitId)
          : null;

    if (!fullName || !email || !password || !role) {
      return NextResponse.json(
        { error: "Nome, email, palavra-passe e role são obrigatórios." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(atsUnitId)) {
      return NextResponse.json(
        { error: "Selecione um órgão ATS válido." },
        { status: 400 },
      );
    }

    const { data: existingProfile } = await auth.adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Já existe um utilizador com esse email." },
        { status: 409 },
      );
    }

    const { data: createdUser, error: createError } =
      await auth.adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createError || !createdUser.user) {
      return NextResponse.json(
        { error: createError?.message || "Não foi possível criar o utilizador." },
        { status: 400 },
      );
    }

    const { error: profileError } = await auth.adminClient.from("profiles").upsert(
      {
        id: createdUser.user.id,
        full_name: fullName,
        email,
        role,
        ats_unit_id: atsUnitId,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      await auth.adminClient.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json(
        { error: "Utilizador criado no Auth, mas falhou a criação do perfil." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Utilizador criado com sucesso.",
      user: {
        id: createdUser.user.id,
        email,
        full_name: fullName,
        role,
        ats_unit_id: atsUnitId,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar o utilizador." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthorizedAdminContext(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return NextResponse.json(
        { error: "Utilizador inválido para remoção." },
        { status: 400 },
      );
    }

    if (userId === auth.profile.id) {
      return NextResponse.json(
        { error: "Não pode apagar o seu próprio utilizador administrador." },
        { status: 400 },
      );
    }

    const { error: profileDeleteError } = await auth.adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: "Não foi possível remover o perfil do utilizador." },
        { status: 500 },
      );
    }

    const { error: authDeleteError } = await auth.adminClient.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      return NextResponse.json(
        { error: "Perfil removido, mas falhou a remoção do Auth user." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Utilizador apagado com sucesso.",
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível apagar o utilizador." },
      { status: 500 },
    );
  }
}
