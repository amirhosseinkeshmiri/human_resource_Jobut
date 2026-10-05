import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/auth/session";
import { getEmployerDashboardCompany } from "@/onboarding/company";

export const getEmployerDashboardContext = cache(async () => {
  const employer = await requireEmployer();
  const company = await getEmployerDashboardCompany(employer.id);

  if (!company) redirect("/employer/onboarding");

  return { employer, company };
});
