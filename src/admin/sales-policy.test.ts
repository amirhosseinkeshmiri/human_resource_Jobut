import assert from "node:assert/strict";
import test from "node:test";
import { canIssueAdminChallenge, sumLedgerAmounts } from "@/admin-auth/policy";
import {
  ADMIN_SALES_PAGE_SIZE,
  fillSalesBuckets,
  formatToman,
  getPaidSalesDate,
  getSalesPageCount,
  paidSalesAmount,
  parseAdminSalesParams,
} from "./sales-policy";

test("only paid purchase snapshots contribute to sales", () => {
  assert.equal(paidSalesAmount("paid", 750_000), 750_000);
  assert.equal(paidSalesAmount("pending", 750_000), 0);
});

test("paid sales reporting uses paidAt and never purchase creation time", () => {
  const purchasedAt = new Date("2026-01-01T00:00:00.000Z");
  const paidAt = new Date("2026-01-04T00:00:00.000Z");
  assert.equal(getPaidSalesDate({ status: "paid", paidAt, purchasedAt }), paidAt);
  assert.equal(getPaidSalesDate({ status: "pending", paidAt: null, purchasedAt }), null);
});

test("fixed sales ranges are accepted and an unknown range safely falls back", () => {
  for (const range of ["7d", "30d", "90d", "365d"] as const) {
    assert.equal(parseAdminSalesParams({ range }).range, range);
  }
  assert.equal(parseAdminSalesParams({ range: "all-time" }).range, "30d");
});

test("purchase status filtering and pagination inputs are allowlisted", () => {
  assert.equal(parseAdminSalesParams({ status: "paid" }).status, "paid");
  assert.equal(parseAdminSalesParams({ status: "pending" }).status, "pending");
  assert.equal(parseAdminSalesParams({ status: "refunded" }).status, "all");
  assert.equal(parseAdminSalesParams({ page: "-4" }).page, 1);
  assert.equal(getSalesPageCount(ADMIN_SALES_PAGE_SIZE + 1), 2);
});

test("credit aggregation preserves signed and negative ledger truth", () => {
  assert.equal(sumLedgerAmounts([4, -7]), -3);
  assert.equal(sumLedgerAmounts([]), 0);
});

test("missing time buckets are presentation-filled with zero", () => {
  const buckets = fillSalesBuckets(
    [{ bucket: "2026-06-10", amount: 120_000 }],
    "7d",
    new Date("2026-06-12T12:00:00.000Z"),
  );
  assert.equal(buckets.length, 7);
  assert.equal(buckets.find((bucket) => bucket.key === "2026-06-10")?.amount, 120_000);
  assert.equal(buckets.find((bucket) => bucket.key === "2026-06-11")?.amount, 0);
});

test("sales amount uses Persian digits and Toman convention", () => {
  const formatted = formatToman(123_456);
  assert.match(formatted, /تومان$/);
  assert.match(formatted, /۱۲۳/);
});

test("sales remains behind the existing Admin access policy", () => {
  assert.equal(canIssueAdminChallenge("admin-id"), true);
  assert.equal(canIssueAdminChallenge(null), false);
});
