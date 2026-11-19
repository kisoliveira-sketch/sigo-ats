import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canManagePositionLogs,
  getPositionLogAuthority,
  isUnitWithoutSupervision,
} from "../src/lib/position-log-authority.ts";

const opener = { id: "opening-user", full_name: "Pessoa que abriu" };
const namesake = { id: "other-user", full_name: opener.full_name };
const supervisor = { id: "supervisor-user", full_name: "Supervisora", email: "sup@example.test" };
const open = {
  status: "OPEN",
  opened_by: opener.id,
  opening_notes: "Composição do turno: CTA Operacional: Pessoa que abriu",
};

for (const code of ["TWR_AICE", "AICE_TWR", "AICE", "TWR_BVC", "TWR_SAL", " twr_aice "]) {
  test(`opens position log controls for opener ID only at ${code}`, () => {
    assert.equal(isUnitWithoutSupervision(code), true);
    const authority = getPositionLogAuthority(open, code);
    assert.equal(authority.kind, "opener");
    assert.equal(canManagePositionLogs(authority, opener), true);
    assert.equal(canManagePositionLogs(authority, { id: opener.id, full_name: "Nome atualizado" }), true);
    assert.equal(canManagePositionLogs(authority, namesake), false);
    assert.equal(canManagePositionLogs(authority, null), false);
  });
}

for (const code of ["ACC_SAL", "APP_SAL", "SAL", "TWR_AIPNM", "TWR_UNKNOWN", null]) {
  test(`does not grant fallback in a supervised or unknown unit: ${code}`, () => {
    assert.equal(isUnitWithoutSupervision(code), false);
    assert.equal(canManagePositionLogs(getPositionLogAuthority(open, code), opener), false);
  });
}

test("a named supervisor retains priority in supervised and unsupervised units", () => {
  for (const code of ["TWR_SAL", "ACC_SAL", null]) {
    const shift = { ...open, opening_notes: open.opening_notes + " | Supervisor: SUP@example.test" };
    const authority = getPositionLogAuthority(shift, code);
    assert.equal(authority.kind, "supervisor");
    assert.equal(canManagePositionLogs(authority, supervisor), true);
    assert.equal(canManagePositionLogs(authority, opener), false);
  }
});

test("legacy supervisor name still matches", () => {
  const shift = { ...open, opening_notes: open.opening_notes + " | Supervisor: Supervisora" };
  assert.equal(canManagePositionLogs(getPositionLogAuthority(shift, "ACC_SAL"), supervisor), true);
});

test("empty supervisor line is treated as absent", () => {
  const shift = { ...open, opening_notes: open.opening_notes + " | Supervisor: " };
  assert.equal(canManagePositionLogs(getPositionLogAuthority(shift, "TWR_BVC"), opener), true);
});

test("a missing opener ID or a closed/missing shift never gives fallback", () => {
  for (const shift of [null, { ...open, opened_by: null }, { ...open, status: "CLOSED" }]) {
    assert.equal(canManagePositionLogs(getPositionLogAuthority(shift, "TWR_SAL"), opener), false);
  }
});
