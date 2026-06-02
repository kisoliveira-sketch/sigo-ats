import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "asa12345";

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  { full_name: "Neusa Cardoso", email: "neusa.cardoso@asa.cv" },
  { full_name: "Belmira dos Santos", email: "belmira.santos@asa.cv" },
  { full_name: "Marius dos Anjos", email: "marius.anjos@asa.cv" },
  { full_name: "Carlos Modesto", email: "carlos.modesto@asa.cv" },
  { full_name: "Elio Barros", email: "elio.barros@asa.cv" },
  { full_name: "Francisco Ramos", email: "francisco.ramos@asa.cv" },
  { full_name: "Claudio Barros", email: "claudio.barros@asa.cv" },
  { full_name: "Valnir Morais", email: "valnir.morais@asa.cv" },
  { full_name: "Adilson Carlos Gonçalves Vaz", email: "adilson.vaz@asa.cv" },
  { full_name: "Abigail Fernandes", email: "abigail.fernandes@asa.cv" },
  { full_name: "Carlos Monteiro", email: "carlos.monteiro@asa.cv" },
  { full_name: "Jorge Semedo", email: "jorge.semedo@asa.cv" },
  { full_name: "Janito Carvalho", email: "janito.carvalho@asa.cv" },
  { full_name: "Adalberto Duarte", email: "adalberto.duarte@asa.cv" },
  { full_name: "Elisangelo Vicente", email: "elisangelo.vicente@asa.cv" },
  { full_name: "Marcelo Silva", email: "marcelo.silva@asa.cv" },
  { full_name: "Fabio Dias", email: "fabio.dias@asa.cv" },
  { full_name: "Janice Veiga", email: "janice.veiga@asa.cv" },
  { full_name: "Hamilton Graça", email: "hamilton.graca@asa.cv" },
  { full_name: "Jose Luis Martins", email: "jose.martins@asa.cv" },
];

async function createOrUpdateUser({ full_name, email }) {
  const { data: listedUsers, error: listError } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const existingUser = listedUsers.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existingUser) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      },
    );

    if (updateError) {
      throw new Error(`Failed to update ${email}: ${updateError.message}`);
    }

    return { action: "updated", email };
  }

  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      full_name,
    },
  });

  if (createError) {
    throw new Error(`Failed to create ${email}: ${createError.message}`);
  }

  return { action: "created", email };
}

async function main() {
  const results = [];

  for (const user of users) {
    const result = await createOrUpdateUser(user);
    results.push(result);
    console.log(`${result.action.toUpperCase()}: ${result.email}`);
  }

  console.log("");
  console.log(
    `Done. Processed ${results.length} users with default password "${defaultPassword}".`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
