import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/compact-dashboard.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const css = postcss.parse(readFileSync(new URL("../src/components/compact-dashboard.module.css", import.meta.url), "utf8"));
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
});
const loadedModule = { exports: {} };
const styles = new Proxy({}, {get: (_, key) => key === "__esModule" ? undefined : key});
const mocks = {
  "next/link": (props) => { const attrs = { ...props }; delete attrs.prefetch; return React.createElement("a", attrs); },
  "next/image": ({ alt }) => React.createElement("span", {"aria-label":alt || undefined}),
  "@/components/siro-ui": { AppFooter: () => React.createElement("footer", null, "SIGO-ATS") },
  "./compact-dashboard.module.css": styles,
};
new Function("require", "module", "exports", outputText)((id) => mocks[id] || require(id), loadedModule, loadedModule.exports);
const { CompactDashboard } = loadedModule.exports;
const noOp = () => {};
const base = {
  unitName: "Torre sintética",
  userName: "Nome de teste",
  profileLabel: "Função no turno",
  profileValue: "Supervisor",
  managerLabel: "Supervisor do turno",
  managerName: "Pessoa de teste",
  theme: "light", onTheme: noOp,
  time: "utc", onTime: noOp,
  onLogout: noOp, logoutLoading: false, canAccessAdmin: false,
  lastEvent: { top: "Hoje", bottom: "11:30" },
  shiftStatus: "known", shiftReference: "TWR-FIXTURE-0600", shiftStartLabel: "06:00",
  shiftId: 55, operationalStatus: "Turno aberto", hasOpenShift: true,
  activePositionStatus: "Uma posição no ensaio fictício", activePositionCount: 1, occurrenceCount: 2, followupCount: 1,
  pending: [{label:"2 ocorrências por validar",attention:true}],
  composition: ["Supervisor: Nome de teste"],
  primary: {kind:"newOccurrence", href:"/occurrences/new", label:"Registar nova entrada", description:"Pode registar ocorrência."},
  turn: {label:"Encerrar turno", href:null, reason:"Posição ativa"},
  canViewCloseRequirements: true, canRefresh: true, onRefresh: noOp,
};
const render = (override = {}) => renderToStaticMarkup(React.createElement(CompactDashboard, {...base,...override}));
const count = (html, text) => html.split(text).length - 1;

test("responsive stylesheet chooses a single layout for phone, touch tablet, landscape and desktop matrices", () => {
  function matches(params, cfg) {
    return params.split(",").some((query) => {
      return query.trim().split(/\s+and\s+/).every((part) => {
        const [, key, raw] = part.match(/^\(([^:]+):\s*([^)]+)\)$/) ?? [];
        const size = Number.parseInt(raw);
        switch (key) {
          case "min-width": return cfg.w >= size;
          case "max-width": return cfg.w <= size;
          case "min-height": return cfg.h >= size;
          case "any-pointer": return raw === "coarse" && cfg.touch;
          default: throw new Error("Unhandled media feature: " + part);
        }
      });
    });
  }
  function value(selector, property, cfg) {
    let answer = null;
    css.walkRules(selector, (rule) => {
      if (rule.parent.type === "atrule" && !matches(rule.parent.params, cfg)) return;
      rule.walkDecls(property, ({ value }) => { answer = value; });
    });
    return answer;
  }
  const sizes = [
    [320,568,true,true,false], [375,667,true,true,false], [390,844,true,true,false],
    [768,1024,true,true,true], [820,1180,true,true,true],
    [1024,768,true,true,true], [1194,834,true,true,true],
    [844,390,true,true,false], [740,660,false,true,true],
    [1024,768,false,false,false], [1194,834,false,false,false], [1440,900,false,false,false],
  ];
  for (const [w,h,touch,compact,twoPanes] of sizes) {
    const cfg = {w,h,touch};
    assert.equal(value(/^\.compact$/, "display", cfg), compact ? "block":"none");
    assert.equal(value(/^\.desktop$/, "display", cfg), compact ? "none":"block");
    if (compact) assert.equal(!!value(/^\.grid$/, "grid-template-columns", cfg), twoPanes);
  }
  assert.match(value(/^\.primary$/, "min-height", {w:320,h:568,touch:true}), /^48px$/);
  assert.match(value(/^\.iconControl$/, "height", {w:320,h:568,touch:true}), /^44px$/);
  assert.match(value(/^\.row$/, "min-height", {w:320,h:568,touch:true}), /^51px$/);
  assert.match(value(/^\.disclosure summary$/, "min-height", {w:320,h:568,touch:true}), /^48px$/);
  assert.match(value(/^\.preference select$/, "min-height", {w:320,h:568,touch:true}), /^44px$/);
  assert.match(value(/^\.frame$/, "padding-left", {w:320,h:568,touch:true}), /safe-area-inset-left/);
  assert.match(value(/^\.content$/, "padding-bottom", {w:320,h:568,touch:true}), /safe-area-inset-bottom/);
});

test("single visible-intent action, existing allowed routes, roles and route deduplication", () => {
  const manager = render({canAccessAdmin: true});
  assert.match(manager, /class="compact" data-compact-dashboard=""/);
  assert.equal(count(manager, "data-dashboard-primary="),1);
  assert.equal(count(manager, "role=\"status\""),1);
  for (const route of ["/occurrences/new","/occurrences","/occurrences/55","/shifts/logs","/shifts/close","/admin","/help"]) {
    assert.equal(count(manager,`href="${route}"`),1);
  }
  const member = render({profileValue:"CTA Operacional",canViewCloseRequirements:false,
    turn:{label:"Encerrar turno", href:null,reason:"Posição ativa · Só quem abriu"},
    primary:{kind:"history",href:"/occurrences",label:"Consultar registos ATS",description:"Consulta disponível."}});
  assert.equal(count(member,'href="/occurrences"'),1);
  assert.equal(count(member,'href="/shifts/close"'),0);
  assert.equal(count(member,'href="/admin"'),0);
  assert.equal(count(member,'href="/occurrences/55"'),1);
  const validation = render({primary:{kind:"validate",href:"/occurrences/55",label:"Validar registo ATS",description:"Validação pendente."}});
  assert.equal(count(validation,'href="/occurrences/55"'),1);
  const firstPosition = render({primary:{kind:"firstPosition",href:"/shifts/logs",label:"Registar entrada na posição",description:"Pode registar."}});
  assert.equal(count(firstPosition,'href="/shifts/logs"'),1);
  const close = render({primary:{kind:"close",href:"/shifts/close",label:"Encerrar turno",description:"Pode encerrar."},canViewCloseRequirements:false,
    turn:{label:"Encerrar turno",href:"/shifts/close",reason:null}});
  assert.equal(count(close,'href="/shifts/close"'),1);
  assert.match(manager, /Tema visual/);
  assert.match(manager, /Hora operacional/);
});

test("no shift, check pending and unavailable do not activate stale routes or count zero by guess", () => {
  const empty = render({hasOpenShift:false,shiftId:null,shiftReference:null,operationalStatus:"Sem turno aberto",
    primary:{kind:"open",href:"/shifts/open",label:"Abrir turno operacional",description:"Sem turno."},
    turn:{label:"Abrir turno",href:"/shifts/open",reason:null}});
  assert.equal(count(empty,'href="/shifts/open"'),1);
  assert.equal(count(empty,'href="/occurrences/55"'),0);
  assert.match(empty,/Requer um turno aberto/);
  for (const status of ["checking", "unavailable"]) {
    const stale = render({shiftStatus:status,operationalStatus:"Por confirmar",
      primary:{kind:"refresh",href:null,label:"Atualizar estado",description:"Aguarde verificação."},
      turn:{label:"Encerrar turno",href:null,reason:"Verificação indisponível"}});
    for (const route of ["/shifts/open","/shifts/close","/shifts/logs","/occurrences/55","/occurrences/new"]) {
      assert.equal(count(stale,`href="${route}"`),0);
    }
    assert.doesNotMatch(stale,/TWR-FIXTURE-0600/);
    assert.match(stale,/Estado do turno por confirmar/);
    assert.match(stale,status==="checking"?/disabled=""[^>]*aria-busy="true"/:/Atualizar estado/);
  }
  const partial = render({activePositionCount:null, occurrenceCount:null, followupCount:null,
    primary:{kind:"refresh",href:null,label:"Atualizar estado",description:"Aguarde verificação."},
    turn:{label:"Encerrar turno",href:null,reason:"Verificação indisponível"}});
  assert.equal(count(partial,"<dd>—</dd>"),3);
  assert.match(partial,/Verificação indisponível/);
});

test("long data, preferences and compact dark mode styles preserve hierarchy and do not add prototype state", () => {
  const word = "L".repeat(300);
  const html = render({time:"local",theme:"dark",shiftReference:word,unitName:word,userName:word,composition:[word]});
  assert.match(html,/Local/);
  assert.ok(html.indexOf("data-dashboard-primary") < html.indexOf("Em posição"),"action precedes optional details");
  assert.match(html,new RegExp(word));
  assert.doesNotMatch(html,/sim-grid|confirm-register|DEMO-0612|Perfil na demonstração/);
  assert.doesNotMatch(source,/useEffect|useState|supabase|localStorage|matchMedia/);
  assert.doesNotMatch(source,/\bid=/);
  assert.match(app,/kind: primaryActionKind, href: primaryActionHref, label: primaryActionLabel/);
  assert.match(app,/primaryActionHref \? <Link/);
  assert.match(app,/onRefresh=\{\(\) => refreshDashboardRef\.current\?\.\(\)\}/);
  const rules = css.toString();
  assert.match(rules,/\[data-dashboard-theme="dark"\]/);
  assert.match(rules,/overflow-wrap:\s*anywhere/);
  assert.match(rules,/:focus-visible/);
});
