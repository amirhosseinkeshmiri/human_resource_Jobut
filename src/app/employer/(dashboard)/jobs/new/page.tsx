import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, FormField, Input, buttonClassNames } from "@/components/ui";
import { createDraftJob } from "@/jobs/actions";
import { JOB_TITLE_MAX_LENGTH } from "@/jobs/policy";

export const metadata: Metadata = { title: "افزودن آگهی جدید" };

interface NewJobPageProps { searchParams: Promise<{ error?: string | string[] }>; }

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = error === "title"
    ? "عنوان آگهی را به‌درستی وارد کنید."
    : error === "persistence" ? "ذخیره پیش‌نویس انجام نشد. دوباره تلاش کنید." : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-meta">آگهی‌ها</p>
      <h1 className="text-page-title mt-2">افزودن آگهی جدید</h1>
      <p className="text-secondary mt-3">این آگهی فقط به‌صورت پیش‌نویس ذخیره می‌شود و اعتباری مصرف نمی‌کند.</p>
      <Card className="mt-8 shadow-none">
        <form action={createDraftJob} className="grid gap-6">
          <FormField id="job-title" label="عنوان آگهی" required error={errorMessage}>
            <Input name="title" maxLength={JOB_TITLE_MAX_LENGTH} autoComplete="off" autoFocus required />
          </FormField>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href="/employer/jobs" className={buttonClassNames({ variant: "secondary" })}>انصراف</Link>
            <Button type="submit">ذخیره پیش‌نویس</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
