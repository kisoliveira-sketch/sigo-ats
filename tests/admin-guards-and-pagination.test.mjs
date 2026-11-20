import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTS(path, requireImpl = () => { throw new Error("unexpected import"); }) {
  const src = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const out = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const context = {
    exports: {}, require: requireImpl,
    process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1234",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only",
    } },
  };
  vm.runInNewContext(out.outputText, context);
  return context.exports;
}

const { readAllAdminRows } = loadTS("../src/lib/admin-paginated-read.ts");

test("counts continue through small gateway pages using non-overlapping keys", async () => {
  const source = Array.from({ length: 1202 }, (_, index) => ({ id: index + 1 }));
  const rows = await readAllAdminRows((after) => Promise.resolve({
    data: source.filter((row) => after === null || row.id > after).slice(0, 83), error: null,
  }));
  assert.equal(rows.length, 1202);
  assert.equal(new Set(rows.map((x) => x.id)).size, 1202);
});

test("counts fail rather than return partial results on failed/repeated pages", async () => {
  await assert.rejects(readAllAdminRows((after) => Promise.resolve(after === null
    ? { data: [{ id: 1 }], error: null } : { data: null, error: { code: "upstream" } })), /admin_page_unavailable/);
  await assert.rejects(readAllAdminRows(() => Promise.resolve({ data: [{ id: 1 }], error: null })), /order_incompatible/);
});

test("ADMIN and current AAL2 are independent checks; default review access is unchanged", async () => {
  const scenarios = [
    { user: false, level: "aal2", role: "ADMIN", enforce: true, expect: 401 },
    { user: true, level: "aal2", role: "CTA", enforce: true, expect: 403 },
    { user: true, level: "aal1", role: "ADMIN", enforce: true, expect: 403 },
    { user: true, level: "aal1", role: "ADMIN", enforce: false, expect: "ADMIN" },
    { user: true, level: "aal2", role: "ADMIN", enforce: true, expect: "ADMIN" },
    { user: true, level: null, role: "ADMIN", enforce: true, expect: 403 },
  ];
  for (const scenario of scenarios) {
    const { getAuthorizedAdminContext } = loadTS("../src/lib/admin-server.ts", () => ({
      createClient: () => ({
        auth: {
          getUser: async (token) => (assert.equal(token, "synthetic-token"), { data: { user: scenario.user ? { id: "fixture" } : null }, error: null }),
          mfa: { getAuthenticatorAssuranceLevel: async (token) => (
            assert.equal(token, "synthetic-token"),
            { data: { currentLevel: scenario.level, nextLevel: "aal2" }, error: null }
          ) },
        },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { id: "fixture", role: scenario.role }, error: null,
        }) }) }) }),
      }),
    }));
    const result = await getAuthorizedAdminContext(
      { headers: new Headers({ authorization: "Bearer synthetic-token" }) },
      ["ADMIN"], { requireMfa: scenario.enforce },
    );
    assert.equal(result.error?.status ?? result.profile.role, scenario.expect);
  }
});
