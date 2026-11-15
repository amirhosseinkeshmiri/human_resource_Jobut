import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  BRAND_NAME_EN,
  BRAND_NAME_FA,
  getPublicOrigin,
  STAGE_A_PUBLIC_ORIGIN,
} from "./identity";

const currentBrandSurfaces = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/admin/(dashboard)/layout.tsx",
  "src/app/admin/login/page.tsx",
  "src/components/brand/brand-logo.tsx",
  "src/components/landing/public-header.tsx",
  "src/components/landing/public-footer.tsx",
  "src/auth/email/smtp.ts",
  "src/resume/pdf-document.ts",
  "src/resume/pdf-policy.ts",
];

test("current brand identity is Jobokar and جابوکار", () => {
  assert.equal(BRAND_NAME_EN, "Jobokar");
  assert.equal(BRAND_NAME_FA, "جابوکار");
});

test("current user-visible brand surfaces contain no retired brand identity", () => {
  const retired = /JobUT|Jobut|JOBUT|جاب‌یوت|جاب یوت|جابیوت|شبکه متخصصین آکادمیک ایران|شبکه استخدامی متخصصین آکادمیک/;
  for (const filename of currentBrandSurfaces) {
    const source = readFileSync(path.join(process.cwd(), filename), "utf8")
      .replaceAll("jobut.ir", "stage-a-domain.invalid");
    assert.equal(retired.test(source), false, filename);
  }
});

test("Stage A metadata routes retain the current origin centrally", () => {
  assert.equal(getPublicOrigin({ APP_URL: undefined }), STAGE_A_PUBLIC_ORIGIN);
  assert.equal(getPublicOrigin({ APP_URL: "https://www.jobut.ir" }), "https://www.jobut.ir");
  assert.equal(manifest().name, "جابوکار | Jobokar");
  assert.equal(robots().host, "https://www.jobut.ir");
  assert.equal(sitemap().every((entry) => entry.url.startsWith("https://www.jobut.ir/")), true);
});

test("future origin is configurable without activating it in Stage A", () => {
  assert.equal(getPublicOrigin({ APP_URL: "https://jobokar.com" }), "https://jobokar.com");
});
