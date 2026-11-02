import assert from "node:assert/strict";
import test from "node:test";
import {
  clearFormDraft,
  getFormDraftKey,
  loadFormDraft,
  saveFormDraft,
  type BrowserStorage,
  type FormDraftOptions,
} from "./form-draft";

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const scope = { accountId: "10000000-0000-4000-8000-000000000001", formId: "job-post", entityId: "new" };
const options: FormDraftOptions = {
  scope,
  allowedFields: ["title", "location", "requiredSkills"],
  now: () => 2_000,
};

test("validation and recoverable server failures can retain allowlisted input", () => {
  const storage = new MemoryStorage();
  assert.equal(saveFormDraft(storage, options, { title: "مهندس", location: "تهران", ignored: "no" }), true);
  assert.deepEqual(loadFormDraft(storage, options), {
    values: { title: "مهندس", location: "تهران" },
    updatedAt: 2_000,
  });
});

test("refresh and navigation return restore the latest compatible draft", () => {
  const storage = new MemoryStorage();
  saveFormDraft(storage, options, { title: "نسخه تازه", requiredSkills: ["TypeScript"] });
  assert.equal(loadFormDraft(storage, options)?.values.title, "نسخه تازه");
});

test("drafts are isolated by account and entity identifiers", () => {
  const storage = new MemoryStorage();
  saveFormDraft(storage, options, { title: "حساب اول" });
  assert.equal(loadFormDraft(storage, { ...options, scope: { ...scope, accountId: "20000000-0000-4000-8000-000000000002" } }), null);
  assert.equal(loadFormDraft(storage, { ...options, scope: { ...scope, entityId: "30000000-0000-4000-8000-000000000003" } }), null);
});

test("confirmed success and explicit discard clear only the intended draft", () => {
  const storage = new MemoryStorage();
  saveFormDraft(storage, options, { title: "پیش‌نویس" });
  assert.equal(clearFormDraft(storage, scope), true);
  assert.equal(loadFormDraft(storage, options), null);
});

test("sensitive fields are rejected even when mistakenly allowlisted", () => {
  const storage = new MemoryStorage();
  assert.equal(saveFormDraft(storage, { ...options, allowedFields: ["title", "otpCode"] }, { title: "x", otpCode: "123456" }), false);
  assert.equal(storage.values.size, 0);
});

test("corrupted, expired, stale, and incompatible drafts fail closed and are removed", () => {
  const storage = new MemoryStorage();
  const key = getFormDraftKey(scope);
  storage.setItem(key, "not-json");
  assert.equal(loadFormDraft(storage, options), null);
  saveFormDraft(storage, options, { title: "قدیمی" });
  assert.equal(loadFormDraft(storage, options, 2_000), null);
  saveFormDraft(storage, options, { title: "منقضی" });
  assert.equal(loadFormDraft(storage, { ...options, now: () => 10_000, maxAgeMs: 1_000 }), null);
  saveFormDraft(storage, options, { title: "نسخه ناسازگار" });
  assert.equal(loadFormDraft(storage, { ...options, schemaVersion: 2 }), null);
});

test("unavailable browser storage never breaks the form", () => {
  const unavailable: BrowserStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(saveFormDraft(unavailable, options, { title: "x" }), false);
  assert.equal(loadFormDraft(unavailable, options), null);
  assert.equal(clearFormDraft(unavailable, scope), false);
});

test("company profile drafts persist only eligible text and benefit identifiers", () => {
  const storage = new MemoryStorage();
  const companyOptions: FormDraftOptions = {
    ...options,
    scope: { ...scope, formId: "company-profile", entityId: "new" },
    allowedFields: ["name", "industryId", "address", "foundingYear", "benefitIds"],
  };
  saveFormDraft(storage, companyOptions, {
    name: "شرکت نمونه",
    industryId: "30000000-0000-4000-8000-000000000003",
    address: "تهران",
    foundingYear: "۱۴۰۰",
    benefitIds: ["40000000-0000-4000-8000-000000000004"],
    logo: { name: "logo.png" },
    gallery: [{ name: "office.jpg" }],
    email: "private@example.com",
    mobile: "09120000000",
  });

  assert.deepEqual(loadFormDraft(storage, companyOptions)?.values, {
    name: "شرکت نمونه",
    industryId: "30000000-0000-4000-8000-000000000003",
    address: "تهران",
    foundingYear: "۱۴۰۰",
    benefitIds: ["40000000-0000-4000-8000-000000000004"],
  });
  assert.equal(loadFormDraft(storage, { ...companyOptions, scope: { ...companyOptions.scope, formId: "job-post" } }), null);
});

test("candidate preference drafts contain only actual preference arrays and remain account scoped", () => {
  const storage = new MemoryStorage();
  const candidateOptions: FormDraftOptions = {
    ...options,
    scope: { ...scope, formId: "candidate-job-preferences", entityId: "self" },
    allowedFields: [
      "preferredLocations",
      "preferredWorkplaceTypes",
      "preferredEmploymentTypes",
      "preferredSeniorityLevels",
    ],
  };
  saveFormDraft(storage, candidateOptions, {
    preferredLocations: ["تهران", "کرج"],
    preferredWorkplaceTypes: ["remote"],
    preferredEmploymentTypes: ["full_time"],
    preferredSeniorityLevels: ["mid"],
    email: "candidate@example.com",
    mobile: "09120000000",
    nationalId: "0012345678",
  });

  assert.deepEqual(loadFormDraft(storage, candidateOptions)?.values, {
    preferredLocations: ["تهران", "کرج"],
    preferredWorkplaceTypes: ["remote"],
    preferredEmploymentTypes: ["full_time"],
    preferredSeniorityLevels: ["mid"],
  });
  assert.equal(loadFormDraft(storage, {
    ...candidateOptions,
    scope: { ...candidateOptions.scope, accountId: "50000000-0000-4000-8000-000000000005" },
  }), null);
  assert.equal(loadFormDraft(storage, candidateOptions, 2_000), null);
});

test("temporary Resume drafts preserve nested sections without accepting unrelated sensitive fields", () => {
  const sessionStorage = new MemoryStorage();
  const resumeOptions: FormDraftOptions = {
    ...options,
    scope: { ...scope, formId: "candidate-resume", entityId: "60000000-0000-4000-8000-000000000006" },
    allowedFields: [
      "firstName", "lastName", "city", "professionalTitle", "professionalSummary",
      "skills", "linkedinUrl", "portfolioUrl", "experiences", "educations", "languages",
    ],
  };
  const nested = {
    experiences: [{ jobTitle: "توسعه‌دهنده", companyName: "نمونه", startDate: "2024-01-01", endDate: "", isCurrent: true, description: "API" }],
    educations: [{ fieldOfStudy: "مهندسی", institutionName: "دانشگاه", degree: "کارشناسی", startDate: "2019-01-01", endDate: "2023-01-01", isCurrent: false }],
    languages: [{ name: "فارسی", proficiency: "native" }],
  };
  saveFormDraft(sessionStorage, resumeOptions, {
    firstName: "نام",
    lastName: "نام خانوادگی",
    city: "تهران",
    professionalTitle: "مهندس نرم‌افزار",
    professionalSummary: "خلاصه",
    skills: ["TypeScript"],
    linkedinUrl: "",
    portfolioUrl: "",
    ...nested,
    email: "private@example.com",
    mobile: "09120000000",
    nationalId: "0012345678",
    uploadedDocument: { name: "resume.pdf" },
  });

  const restored = loadFormDraft(sessionStorage, resumeOptions);
  assert.deepEqual(restored?.values.experiences, nested.experiences);
  assert.deepEqual(restored?.values.educations, nested.educations);
  assert.deepEqual(restored?.values.languages, nested.languages);
  assert.equal(Object.hasOwn(restored?.values ?? {}, "email"), false);
  assert.equal(Object.hasOwn(restored?.values ?? {}, "uploadedDocument"), false);
  assert.equal(loadFormDraft(sessionStorage, {
    ...resumeOptions,
    scope: { ...resumeOptions.scope, entityId: "70000000-0000-4000-8000-000000000007" },
  }), null);
});
