import assert from "node:assert/strict";
import { test } from "node:test";
import { isUnitWithoutSupervision } from "../src/lib/position-log-authority.ts";

for (const code of ["TWR_AICE", "AICE_TWR", "AICE", "TWR_BVC", "TWR_SAL", " twr_aice "]) {
  test(`uses the non-supervised opening default for ${code}`, () => {
    assert.equal(isUnitWithoutSupervision(code), true);
  });
}

for (const code of ["ACC_SAL", "APP_SAL", "SAL", "TWR_AIPNM", "TWR_UNKNOWN", null]) {
  test(`does not use the non-supervised opening default for ${code}`, () => {
    assert.equal(isUnitWithoutSupervision(code), false);
  });
}
// Authority and roster integrity use account IDs and are tested in shift-authority.sql.
