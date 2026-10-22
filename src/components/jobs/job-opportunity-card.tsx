import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { PUBLIC_JOB_LABEL } from "@/jobs/public-copy";
import { formatJobSalary } from "@/jobs/public-policy";
import {
  buildJobOpportunityPresentation,
  type JobOpportunityCardData,
} from "@/jobs/card-presentation";
import {
  employmentTypeLabels,
  seniorityLevelLabels,
  workplaceTypeLabels,
} from "@/jobs/validation";
import { CompanyLogo } from "./company-logo";

interface JobOpportunityCardProps {
  job: JobOpportunityCardData;
  skills?: string[] | null;
  skillSummary?: string;
  reasons?: string[];
  variant?: "full" | "compact";
  headingLevel?: "h2" | "h3";
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export function JobOpportunityCard({
  job,
  skills,
  skillSummary,
  reasons = [],
  variant = "full",
  headingLevel = "h2",
}: JobOpportunityCardProps) {
  const presentation = buildJobOpportunityPresentation(job, skills, reasons);
  const { visible: visibleSkills, remaining: remainingSkills } = presentation.skills;
  const Heading = headingLevel;
  const detailHref = presentation.detailHref;
  const showSalary = job.salaryNegotiable !== undefined;

  return <Card className="group flex h-full min-w-0 flex-col border-ui-border bg-white shadow-[0_1px_2px_rgb(20_33_145/0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-action/25 hover:shadow-[0_8px_24px_rgb(20_33_145/0.08)] motion-reduce:transform-none">
    <div className="flex min-w-0 items-start gap-3">
      <CompanyLogo companyName={job.companyName} logoUrl={job.companyLogoUrl} />
      <div className="min-w-0 flex-1">
        <Heading className="line-clamp-2 break-words text-lg font-bold leading-7 text-action">
          <Link href={detailHref} className="rounded-sm outline-none group-hover:text-action-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">{job.title}</Link>
        </Heading>
        <p className="mt-1 truncate text-sm font-semibold text-text-secondary">{job.companyName}</p>
        {job.industryName && variant === "full" ? <p className="text-meta mt-1 truncate">{job.industryName}</p> : null}
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2" aria-label="مشخصات فرصت شغلی">
      {job.location ? <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">{job.location}</span> : null}
      {job.workplaceType ? <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">{workplaceTypeLabels[job.workplaceType]}</span> : null}
      {job.employmentType ? <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">{employmentTypeLabels[job.employmentType]}</span> : null}
      {job.seniorityLevel ? <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">{seniorityLevelLabels[job.seniorityLevel]}</span> : null}
    </div>

    {showSalary && variant === "full" ? <p className="text-label mt-4">{formatJobSalary({ salaryMin: job.salaryMin ?? null, salaryMax: job.salaryMax ?? null, salaryNegotiable: job.salaryNegotiable ?? null })}</p> : null}
    {visibleSkills.length ? <div className="mt-4">{skillSummary ? <p className="text-label mb-2">{skillSummary}</p> : null}<div className="flex flex-wrap gap-2">{visibleSkills.map((skill) => <Badge key={skill} variant={reasons.length ? "success" : "neutral"}>{skill}</Badge>)}{remainingSkills > 0 ? <Badge>+{remainingSkills.toLocaleString("fa-IR")} مهارت دیگر</Badge> : null}</div></div> : null}
    {reasons.length ? <div className="mt-4 flex flex-wrap gap-2" aria-label="دلایل پیشنهاد">{reasons.map((reason) => <Badge key={reason}>{reason}</Badge>)}</div> : null}

    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-ui-border pt-4">
      {job.publishedAt && variant === "full" ? <time className="text-meta" dateTime={job.publishedAt.toISOString()}>{dateFormatter.format(job.publishedAt)}</time> : <span />}
      <Link href={detailHref} className="inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">مشاهده {PUBLIC_JOB_LABEL} ←</Link>
    </div>
  </Card>;
}
