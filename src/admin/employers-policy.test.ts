import assert from "node:assert/strict";
import test from "node:test";
import { paidPurchaseRevenue, sumLedgerAmounts } from "@/admin-auth/policy";
import {
  ADMIN_EMPLOYERS_PAGE_SIZE,
  getPageCount,
  isCompanyId,
  parseEmployerListParams,
} from "./employers-policy";

test("employer list supports job, paid purchase, and credit sorting", () => {
  assert.equal(parseEmployerListParams({ sort: "jobs_asc" }).sort, "jobs_asc");
  assert.equal(parseEmployerListParams({ sort: "paid_desc" }).sort, "paid_desc");
  assert.equal(parseEmployerListParams({ sort: "credits_asc" }).sort, "credits_asc");
  assert.equal(parseEmployerListParams({ sort: "unknown" }).sort, "jobs_desc");
});

test("search is trimmed, bounded, and pagination uses a stable server-side offset", () => {
  const parsed = parseEmployerListParams({ q: "  تهران  ", page: "3" });
  assert.equal(parsed.query, "تهران");
  assert.equal(parsed.page, 3);
  assert.equal(parsed.offset, ADMIN_EMPLOYERS_PAGE_SIZE * 2);
  assert.equal(parseEmployerListParams({ page: "-1" }).page, 1);
  assert.equal(getPageCount(0), 1);
  assert.equal(getPageCount(ADMIN_EMPLOYERS_PAGE_SIZE + 1), 2);
});

test("pending purchases are excluded from paid purchase totals", () => {
  const total = paidPurchaseRevenue("paid", 800_000) + paidPurchaseRevenue("pending", 900_000);
  assert.equal(total, 800_000);
});

test("credit balance derives from signed canonical ledger entries", () => {
  assert.equal(sumLedgerAmounts([10, -1, -2]), 7);
  assert.equal(sumLedgerAmounts([]), 0);
});

test("unknown or malformed company identifiers are rejected before querying detail", () => {
  assert.equal(isCompanyId("not-a-company"), false);
  assert.equal(isCompanyId("123e4567-e89b-12d3-a456-426614174000"), true);
});
