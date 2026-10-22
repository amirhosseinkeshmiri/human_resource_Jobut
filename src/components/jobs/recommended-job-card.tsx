import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import {
  employmentTypeLabels,
  seniorityLevelLabels,
  workplaceTypeLabels,
} from "@/jobs/validation";
import { CompanyLogo } from "./company-logo";

interface RecommendedJobCardProps {
  job: {
    id: string;
    title: string;
    companyName: string;
    companyLogoUrl: string | null;
    industryName: string;
    location: string | null;
    workplaceType: keyof typeof workplaceTypeLabels | null;
    employmentType: keyof typeof employmentTypeLabels | null;
    seniorityLevel: keyof typeof seniorityLevelLabels | null;
    publishedAt: Date | null;
    matchedSkills: string[];
    locationMatched: boolean;
    workplaceMatched: boolean;
    employmentMatched: boolean;
    seniorityMatched: boolean;
    resumeCityMatched: boolean;
  };
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export function RecommendedJobCard({ job }: RecommendedJobCardProps) {
  const visibleSkills = job.matchedSkills.slice(0, 3);
  const remainingSkills = job.matchedSkills.length - visibleSkills.length;
  const reasons = [
    job.locationMatched ? "محل موردنظر شما" : null,
    job.workplaceMatched ? "نحوه حضور موردنظر شما" : null,
    job.employmentMatched ? "نوع همکاری موردنظر شما" : null,
    job.seniorityMatched ? "سطح شغلی موردنظر شما" : null,
    job.resumeCityMatched ? "هم‌راستا با شهر رزومه شما" : null,
  ].filter((reason): reason is string => reason !== null);

  return <Card className="flex h-full flex-col shadow-none">
    <div className="flex items-start gap-3"><CompanyLogo companyName={job.companyName} logoUrl={job.companyLogoUrl} /><div className="min-w-0"><h2 className="text-card-title break-words"><Link href={`/jobs/${job.id}`} className="outline-none hover:text-action focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">{job.title}</Link></h2><p className="text-label mt-1 text-text-secondary">{job.companyName}</p><p className="text-meta mt-1">{job.industryName}</p></div></div>
    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary">{job.location ? <span>{job.location}</span> : null}{job.workplaceType ? <span>{workplaceTypeLabels[job.workplaceType]}</span> : null}{job.employmentType ? <span>{employmentTypeLabels[job.employmentType]}</span> : null}{job.seniorityLevel ? <span>{seniorityLevelLabels[job.seniorityLevel]}</span> : null}</div>
    {visibleSkills.length ? <div className="mt-5"><p className="text-label">{job.matchedSkills.length.toLocaleString("fa-IR")} مهارت مشترک</p><div className="mt-2 flex flex-wrap gap-2">{visibleSkills.map((skill) => <Badge key={skill} variant="success">{skill}</Badge>)}{remainingSkills > 0 ? <Badge variant="neutral">+{remainingSkills.toLocaleString("fa-IR")} مهارت دیگر</Badge> : null}</div></div> : null}
    {reasons.length ? <div className="mt-4 flex flex-wrap gap-2" aria-label="دلایل پیشنهاد">{reasons.map((reason) => <Badge key={reason}>{reason}</Badge>)}</div> : null}
    <div className="mt-auto flex items-end justify-between gap-4 border-t border-ui-border pt-5">{job.publishedAt ? <time className="text-meta" dateTime={job.publishedAt.toISOString()}>{dateFormatter.format(job.publishedAt)}</time> : <span />}<Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">مشاهده آگهی ←</Link></div>
  </Card>;
}
