import assert from "node:assert/strict";
import test from "node:test";
import { initialPublicPackageCatalog } from "./initial-catalog";
import {
  calculateUnitPriceToman,
  canDisplayPublicPackage,
  formatToman,
} from "./catalog-policy";
import { canInitiatePackagePurchase } from "./purchase-policy";

test("the five initial catalog definitions preserve exact prices, credits, and unit prices", () => {
  assert.deepEqual(
    initialPublicPackageCatalog.map((item) => ({
      name: item.name,
      credits: item.jobCredits,
      total: item.priceToman,
      unit: calculateUnitPriceToman(item.priceToman, item.jobCredits),
    })),
    [
      { name: "تک آگهی - آزاد", credits: 1, total: 399_000, unit: 399_000 },
      { name: "سه ماهه", credits: 6, total: 2_100_000, unit: 350_000 },
      { name: "شش ماهه", credits: 15, total: 4_500_000, unit: 300_000 },
      { name: "یک ساله", credits: 35, total: 8_750_000, unit: 250_000 },
      { name: "یک ساله نامحدود", credits: 350, total: 70_000_000, unit: 200_000 },
    ],
  );
});

test("unit prices use nearest-whole-toman rounding and Persian toman formatting", () => {
  assert.equal(calculateUnitPriceToman(100, 3), 33);
  assert.equal(calculateUnitPriceToman(101, 2), 51);
  assert.equal(formatToman(2_100_000), "۲٬۱۰۰٬۰۰۰ تومان");
});

test("only active positive catalog records are publicly displayable", () => {
  assert.equal(canDisplayPublicPackage({ isActive: true, jobCredits: 1, priceToman: 1 }), true);
  assert.equal(canDisplayPublicPackage({ isActive: false, jobCredits: 1, priceToman: 1 }), false);
  assert.equal(canDisplayPublicPackage({ isActive: true, jobCredits: 1, priceToman: 0 }), false);
});

test("the historical installment plan is visible but cannot initiate online SEP checkout", () => {
  const installment = initialPublicPackageCatalog[4];
  assert.equal(installment.jobCredits, 350);
  assert.equal(installment.onlineCheckoutEnabled, false);
  assert.match(installment.paymentDescription, /فعلاً آنلاین فعال نیست/);
  assert.equal(canInitiatePackagePurchase({ ...installment, id: "installment", isActive: true }), false);
});
