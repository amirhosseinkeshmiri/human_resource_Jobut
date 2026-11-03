import assert from "node:assert/strict";
import test from "node:test";
import { renderResumePdf } from "./pdf-document.ts";
import { isSafeResumePdf, type ResumePdfData } from "./pdf-policy.ts";

test("Persian and mixed English Resume renders as a valid searchable multi-page PDF", async () => {
  const longDescription = "طراحی و توسعه سامانه‌های استخدامی RTL با React و TypeScript و همکاری نزدیک با تیم محصول. ".repeat(16);
  const resume: ResumePdfData = {
    candidateAccountId: "candidate-a",
    firstName: "سارا",
    lastName: "احمدی",
    city: "تهران",
    professionalTitle: "Senior Front-end Developer",
    professionalSummary: "توسعه‌دهنده نرم‌افزار با تجربه در React و TypeScript.",
    skills: ["TypeScript", "React", "طراحی رابط کاربری"],
    linkedinUrl: "https://www.linkedin.com/in/example",
    portfolioUrl: null,
    experiences: Array.from({ length: 12 }, (_, index) => ({
      id: `experience-${index}`,
      jobTitle: `توسعه‌دهنده نرم‌افزار ${index + 1}`,
      companyName: "شرکت نمونه",
      startDate: "2022-01-01",
      endDate: null,
      isCurrent: true,
      description: longDescription,
    })),
    educations: [],
    languages: [{ id: "language-a", name: "انگلیسی", proficiency: "advanced" }],
    credentials: [{
      id: "credential-a",
      recordType: "training_course",
      title: "دوره پیشرفته طراحی سامانه‌های توزیع‌شده",
      issuer: "مرکز آموزش نمونه",
      issueDate: "2025-05-01",
      expirationDate: null,
      credentialId: "CERT-2025-001",
      verificationUrl: "https://example.com/verify/CERT-2025-001",
      description: "یادگیری معماری مقاوم و پایش سرویس‌های توزیع‌شده.",
    }],
  };
  const pdf = await renderResumePdf(resume);
  const pdfSource = pdf.toString("latin1");
  assert.equal(isSafeResumePdf(pdf), true);
  assert.ok(pdf.byteLength > 20_000);
  assert.ok((pdfSource.match(/\/Type \/Page\b/g) ?? []).length > 1);
});
