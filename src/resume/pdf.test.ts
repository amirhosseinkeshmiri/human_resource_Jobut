import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResumePdfContentDisposition,
  buildResumePdfFilename,
  canExportOwnedResume,
  isSafeResumePdf,
  isolateResumeRtlText,
  RESUME_PDF_PRIVATE_CACHE_CONTROL,
  safeResumeLink,
  type ResumePdfData,
} from "./pdf-policy";
import { createCandidateResumePdfResponse } from "./pdf-response";

const baseResume: ResumePdfData = {
  candidateAccountId: "candidate-a",
  firstName: "سارا",
  lastName: "احمدی",
  city: "تهران",
  professionalTitle: "Senior Front-end Developer",
  professionalSummary: "توسعه‌دهنده نرم‌افزار با تجربه در React و TypeScript.",
  skills: ["TypeScript", "React", "طراحی رابط کاربری"],
  linkedinUrl: "https://www.linkedin.com/in/example",
  portfolioUrl: "https://example.com/portfolio",
  experiences: [{
    id: "experience-a",
    jobTitle: "توسعه‌دهنده ارشد Front-end",
    companyName: "شرکت نمونه",
    startDate: "2022-01-01",
    endDate: null,
    isCurrent: true,
    description: "توسعه محصولات فارسی RTL با همکاری تیم محصول.",
  }],
  educations: [{
    id: "education-a",
    fieldOfStudy: "مهندسی کامپیوتر",
    institutionName: "دانشگاه تهران",
    degree: "کارشناسی",
    startDate: "2017-09-01",
    endDate: "2021-06-01",
    isCurrent: false,
  }],
  languages: [{ id: "language-a", name: "انگلیسی", proficiency: "advanced" }],
  credentials: [],
};

function fakePdf() {
  return new TextEncoder().encode("%PDF-1.7\nvalid-pdf-test-body");
}

test("PDF export ownership rejects anonymous and cross-account access", () => {
  assert.equal(canExportOwnedResume(null, "candidate-a"), false);
  assert.equal(canExportOwnedResume("candidate-b", "candidate-a"), false);
  assert.equal(canExportOwnedResume("candidate-a", "candidate-a"), true);
});

test("unauthorized response never performs a Resume lookup", async () => {
  let loaded = false;
  const response = await createCandidateResumePdfResponse({
    authenticatedCandidateId: null,
    loadResume: async () => { loaded = true; return baseResume; },
    renderPdf: async () => fakePdf(),
  });
  assert.equal(response.status, 401);
  assert.equal(loaded, false);
});

test("missing Resume and mismatched ownership return not found without rendering", async () => {
  let rendered = false;
  const missing = await createCandidateResumePdfResponse({
    authenticatedCandidateId: "candidate-a",
    loadResume: async () => null,
    renderPdf: async () => { rendered = true; return fakePdf(); },
  });
  const mismatched = await createCandidateResumePdfResponse({
    authenticatedCandidateId: "candidate-a",
    loadResume: async () => ({ ...baseResume, candidateAccountId: "candidate-b" }),
    renderPdf: async () => { rendered = true; return fakePdf(); },
  });
  assert.equal(missing.status, 404);
  assert.equal(mismatched.status, 404);
  assert.equal(rendered, false);
});

test("successful response has a safe filename and private download headers", async () => {
  const response = await createCandidateResumePdfResponse({
    authenticatedCandidateId: "candidate-a",
    loadResume: async () => baseResume,
    renderPdf: async () => fakePdf(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), RESUME_PDF_PRIVATE_CACHE_CONTROL);
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  assert.match(response.headers.get("content-disposition") ?? "", /^attachment;/);
  assert.match(response.headers.get("content-disposition") ?? "", /filename\*=UTF-8''/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(isSafeResumePdf(new Uint8Array(await response.arrayBuffer())), true);
});

test("filename strips traversal, controls, and bidi overrides", () => {
  const filename = buildResumePdfFilename("../سارا", "احمدی\u202e.pdf");
  assert.equal(filename.includes("/"), false);
  assert.equal(filename.includes("\\"), false);
  assert.equal(filename.includes("\u202e"), false);
  assert.match(buildResumePdfContentDisposition(filename), /filename="jobut-resume\.pdf"/);
});

test("render failures and invalid output fail privately with sanitized diagnostics", async () => {
  const events: Array<{ event: "candidate_resume_pdf_failure"; code: string }> = [];
  const response = await createCandidateResumePdfResponse({
    authenticatedCandidateId: "candidate-a",
    loadResume: async () => baseResume,
    renderPdf: async () => { throw new Error("private resume content"); },
    logFailure: (event) => events.push(event),
  });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(events, [{ event: "candidate_resume_pdf_failure", code: "GENERATION_FAILED" }]);
  assert.equal(JSON.stringify(events).includes("private resume content"), false);
});

test("unsafe links are omitted at the PDF boundary", () => {
  assert.equal(safeResumeLink("javascript:alert(1)"), null);
  assert.equal(safeResumeLink("not a url"), null);
  assert.equal(safeResumeLink("https://example.com/path"), "https://example.com/path");
});

test("Persian mixed-direction text receives an explicit RTL embedding", () => {
  assert.equal(isolateResumeRtlText("React TypeScript"), "React TypeScript");
  assert.equal(isolateResumeRtlText("توسعه با React"), "\u202bتوسعه با React\u202c");
});

