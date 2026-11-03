import assert from "node:assert/strict";
import test from "node:test";
import { getCityComboboxKeyAction } from "./province-city-field-policy";

test("city combobox keyboard navigation remains bounded and selects only an active open option", () => {
  assert.deepEqual(getCityComboboxKeyAction("ArrowDown", 0, 3, true), { type: "navigate", activeIndex: 1 });
  assert.deepEqual(getCityComboboxKeyAction("ArrowDown", 2, 3, true), { type: "navigate", activeIndex: 2 });
  assert.deepEqual(getCityComboboxKeyAction("ArrowUp", 0, 3, true), { type: "navigate", activeIndex: 0 });
  assert.deepEqual(getCityComboboxKeyAction("Enter", 1, 3, true), { type: "select", activeIndex: 1 });
  assert.equal(getCityComboboxKeyAction("Enter", 1, 3, false), null);
  assert.equal(getCityComboboxKeyAction("ArrowDown", 0, 0, true), null);
  assert.deepEqual(getCityComboboxKeyAction("Escape", 0, 0, true), { type: "close" });
});
