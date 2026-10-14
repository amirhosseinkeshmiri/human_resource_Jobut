import type { Metadata } from "next";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { ResumeBuilderForm } from "@/components/resume/resume-builder-form";
import { ResumePreview } from "@/components/resume/resume-preview";
import { saveCandidateResume } from "@/resume/actions";
import { getCandidateResume } from "@/resume/queries";

export const metadata: Metadata = { title: "رزومه من" };

interface PageProps { searchParams: Promise<{ mode?: string | string[]; saved?: string | string[]; error?: string | string[] }>; }

export default async function CandidateResumePage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const [resume, query] = await Promise.all([getCandidateResume(candidate.id), searchParams]);
  const mode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const saved = (Array.isArray(query.saved) ? query.saved[0] : query.saved) === "1";
  const invalid = (Array.isArray(query.error) ? query.error[0] : query.error) === "invalid";

  const initialValues = resume ? {
    firstName: resume.firstName,
    lastName: resume.lastName,
    city: resume.city,
    professionalTitle: resume.professionalTitle,
    professionalSummary: resume.professionalSummary,
    skills: resume.skills,
    linkedinUrl: resume.linkedinUrl ?? "",
    portfolioUrl: resume.portfolioUrl ?? "",
    experiences: resume.experiences.map((item) => ({ jobTitle: item.jobTitle, companyName: item.companyName, startDate: item.startDate, endDate: item.endDate ?? "", isCurrent: item.isCurrent, description: item.description ?? "" })),
    educations: resume.educations.map((item) => ({ fieldOfStudy: item.fieldOfStudy, institutionName: item.institutionName, degree: item.degree, startDate: item.startDate, endDate: item.endDate ?? "", isCurrent: item.isCurrent })),
    languages: resume.languages.map((item) => ({ name: item.name, proficiency: item.proficiency })),
  } : undefined;

  return <CandidateShell current="resume"><div className="mx-auto max-w-4xl">{saved ? <p role="status" className="mb-5 rounded-md border border-success/30 bg-success/5 p-3 text-sm font-semibold text-success">رزومه با موفقیت ذخیره شد.</p> : null}{resume && mode !== "edit" ? <ResumePreview resume={resume} /> : <><div className="mb-7"><p className="text-meta">رزومه ساختاریافته شبکه استخدامی متخصصین آکادمیک</p><h1 className="text-page-title mt-2">{resume ? "ویرایش رزومه" : "ساخت رزومه"}</h1><p className="text-secondary mt-3">اطلاعات حرفه‌ای خود را در بخش‌های کوتاه و مشخص تکمیل کنید.</p></div><ResumeBuilderForm action={saveCandidateResume} initialValues={initialValues} serverError={invalid ? "اطلاعات ارسالی معتبر نبود. لطفاً فیلدها را بررسی کنید." : undefined} /></>}</div></CandidateShell>;
}
