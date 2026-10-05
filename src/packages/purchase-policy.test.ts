import assert from "node:assert/strict";
import test from "node:test";
import {
  canInitiatePackagePurchase,
  createPendingPurchaseSnapshot,
  purchaseSuccessDecision,
  type PurchasablePackage,
} from "./purchase-policy";

const activePackage: PurchasablePackage = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "بسته تأییدشده",
  jobCredits: 5,
  priceToman: 200_000,
  isActive: true,
};

test("inactive packages cannot initiate purchases", () => {
  assert.equal(canInitiatePackagePurchase({ ...activePackage, isActive: false }), false);
  assert.throws(() =>
    createPendingPurchaseSnapshot("company-id", { ...activePackage, isActive: false }),
  );
});

test("purchase starts pending with trusted package snapshot values", () => {
  const purchase = createPendingPurchaseSnapshot("authenticated-company", activePackage);
  assert.deepEqual(purchase, {
    companyId: "authenticated-company",
    jobPackageId: activePackage.id,
    packageName: activePackage.name,
    jobCredits: 5,
    priceToman: 200_000,
    status: "pending",
  });
});

test("pending purchase is eligible for its exact positive credit allocation", () => {
  const purchase = createPendingPurchaseSnapshot("authenticated-company", activePackage);
  assert.equal(purchaseSuccessDecision(purchase.status, false), "allocate");
  assert.equal(purchase.jobCredits, activePackage.jobCredits);
  assert.ok(purchase.jobCredits > 0);
});

test("already paid and allocated purchase is idempotent", () => {
  assert.equal(purchaseSuccessDecision("paid", true), "already-allocated");
});

test("inconsistent paid or pre-allocated states are rejected", () => {
  assert.throws(() => purchaseSuccessDecision("paid", false));
  assert.throws(() => purchaseSuccessDecision("pending", true));
});
