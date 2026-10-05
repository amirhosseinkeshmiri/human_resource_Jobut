"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { jobPackages, packagePurchases } from "@/db/schema";
import { getEmployerDashboardContext } from "@/dashboard/context";
import {
  canInitiatePackagePurchase,
  createPendingPurchaseSnapshot,
} from "./purchase-policy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function initiatePackagePurchase(formData: FormData) {
  const { company } = await getEmployerDashboardContext();
  const packageId = String(formData.get("packageId") ?? "");

  if (!UUID_PATTERN.test(packageId)) redirect("/employer/packages?purchase=unavailable");

  let outcome: "pending" | "unavailable" | "error" = "error";

  try {
    const [jobPackage] = await db
      .select({
        id: jobPackages.id,
        name: jobPackages.name,
        jobCredits: jobPackages.jobCredits,
        priceToman: jobPackages.priceToman,
        isActive: jobPackages.isActive,
      })
      .from(jobPackages)
      .where(eq(jobPackages.id, packageId))
      .limit(1);

    if (!jobPackage || !canInitiatePackagePurchase(jobPackage)) {
      outcome = "unavailable";
    } else {
      await db
        .insert(packagePurchases)
        .values(createPendingPurchaseSnapshot(company.id, jobPackage));
      outcome = "pending";
    }
  } catch {
    outcome = "error";
  }

  redirect(`/employer/packages?purchase=${outcome}`);
}
