import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { formatJobSalary } from "@/jobs/public-policy";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";
import { CompanyLogo } from "./company-logo";

interface PublicJobCardProps {
  job: {
    id: string;
    title: string;
    workplaceType: keyof typeof workplaceTypeLabels | null;
    employmentType: keyof typeof employmentTypeLabels | null;
    location: string | null;
    seniorityLevel: keyof typeof seniorityLevelLabels | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryNegotiable: boolean | null;
    requiredSkills: string[] | null;
    publishedAt: Date | null;
    companyName: string;
    companyLogoUrl: string | null;
    industryName: string;
  };
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export function PublicJobCard({ job }: PublicJobCardProps) {
  const visibleSkills = job.requiredSkills?.slice(0, 4) ?? [];
  const remainingSkills = Math.max((job.requiredSkills?.length ?? 0) - visibleSkills.length, 0);

  return (
    <Card className="flex h-full flex-col shadow-none">
      <div className="flex items-start gap-3">
        <CompanyLogo companyName={job.companyName} logoUrl={job.companyLogoUrl} />
        <div className="min-w-0">
          <h2 className="text-card-title break-words">
            <Link href={`/jobs/${job.id}`} className="outline-none hover:text-action focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">{job.title}</Link>
          </h2>
          <p className="text-label mt-1 text-text-secondary">{job.companyName}</p>
          <p className="text-meta mt-1">{job.industryName}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary">
        {job.location ? <span>{job.location}</span> : null}
        {job.workplaceType ? <span>{workplaceTypeLabels[job.workplaceType]}</span> : null}
        {job.employmentType ? <span>{employmentTypeLabels[job.employmentType]}</span> : null}
        {job.seniorityLevel ? <span>{seniorityLevelLabels[job.seniorityLevel]}</span> : null}
      </div>

      <p className="text-label mt-4">{formatJobSalary(job)}</p>

      {visibleSkills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {visibleSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
          {remainingSkills > 0 ? <Badge variant="neutral">+{remainingSkills.toLocaleString("fa-IR")}</Badge> : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-4 border-t border-ui-border pt-5">
        {job.publishedAt ? <time className="text-meta" dateTime={job.publishedAt.toISOString()}>{dateFormatter.format(job.publishedAt)}</time> : <span />}
        <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">مشاهده آگهی ←</Link>
      </div>
    </Card>
  );
}
