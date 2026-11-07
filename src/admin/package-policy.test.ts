import assert from "node:assert/strict";
import test from "node:test";
import { createPendingPurchaseSnapshot } from "@/packages/purchase-policy";
import {
  isMatchingPackageVersion,
  nextPackageVersion,
  parseAdminPackageInput,
} from "./package-policy";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("Admin package input accepts a bounded paid package and normalizes its name", () => {
  assert.deepEqual(parseAdminPackageInput(form({
    name: "  بسته حرفه‌ای  ",
    priceToman: "250000",
    jobCredits: "3",
    isActive: "on",
    displayOrder: "20",
    displayValidityText: "۹۰ روز نمایشی",
    paymentDescription: "نقد",
    onlineCheckoutEnabled: "on",
  })), {
    name: "بسته حرفه‌ای",
    priceToman: 250000,
    jobCredits: 3,
    isActive: true,
    displayOrder: 20,
    displayValidityText: "۹۰ روز نمایشی",
    paymentDescription: "نقد",
    onlineCheckoutEnabled: true,
  });
});

test("Admin package validation rejects free, fractional, signed, unsafe, and empty values", () => {
  for (const values of [
    { name: "بسته", priceToman: "0", jobCredits: "1" },
    { name: "بسته", priceToman: "1.5", jobCredits: "1" },
    { name: "بسته", priceToman: "+10", jobCredits: "1" },
    { name: "بسته", priceToman: "10", jobCredits: "0" },
    { name: " ", priceToman: "10", jobCredits: "1" },
    { name: "x".repeat(121), priceToman: "10", jobCredits: "1" },
    { name: "بسته", priceToman: "2147483648", jobCredits: "1" },
  ]) assert.equal(parseAdminPackageInput(form(values)), null);
});

test("purchase snapshots remain immutable values after catalog input changes", () => {
  const catalog = { id: "package", name: "قدیمی", priceToman: 100, jobCredits: 1, isActive: true };
  const snapshot = createPendingPurchaseSnapshot("company", catalog);
  catalog.name = "جدید";
  catalog.priceToman = 200;
  catalog.jobCredits = 2;
  assert.deepEqual(snapshot, {
    companyId: "company",
    jobPackageId: "package",
    packageName: "قدیمی",
    priceToman: 100,
    jobCredits: 1,
    status: "pending",
  });
});

test("package versions compare at JavaScript precision and advance monotonically", () => {
  const current = new Date("2026-11-07T08:00:00.123Z");
  assert.equal(isMatchingPackageVersion(current, new Date(current.toISOString())), true);
  assert.equal(isMatchingPackageVersion(current, new Date("2026-11-07T08:00:00.124Z")), false);
  assert.equal(nextPackageVersion(current, current).toISOString(), "2026-11-07T08:00:00.124Z");
});
