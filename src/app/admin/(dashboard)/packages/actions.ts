"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { requireOwnerOnlyOperation } from "@/admin-auth/rbac-guards";
import { parseAdminPackageInput } from "@/admin/package-policy";
import {
  AdminPackageError,
  createAdminPackage,
  updateAdminPackage,
} from "@/admin/packages";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeMutation() {
  if (!(await inspectTrustedAuthActionRequest()).trusted) notFound();
  return requireOwnerOnlyOperation("admin.packages.manage");
}

export async function createPackageAction(formData: FormData) {
  const owner = await authorizeMutation();
  const input = parseAdminPackageInput(formData);
  if (!input) redirect("/admin/packages?result=invalid");
  try {
    await createAdminPackage(owner.adminAccountId, input);
  } catch {
    redirect("/admin/packages?result=error");
  }
  revalidatePath("/admin/packages");
  revalidatePath("/employer/packages");
  redirect("/admin/packages?result=created");
}

export async function updatePackageAction(formData: FormData) {
  const owner = await authorizeMutation();
  const packageId = formData.get("packageId");
  const rawUpdatedAt = formData.get("updatedAt");
  const input = parseAdminPackageInput(formData);
  if (
    typeof packageId !== "string"
    || !UUID_PATTERN.test(packageId)
    || typeof rawUpdatedAt !== "string"
    || !input
  ) redirect("/admin/packages?result=invalid");
  const expectedUpdatedAt = new Date(rawUpdatedAt);
  if (!Number.isFinite(expectedUpdatedAt.getTime()) || expectedUpdatedAt.toISOString() !== rawUpdatedAt) {
    redirect("/admin/packages?result=invalid");
  }
  try {
    await updateAdminPackage(owner.adminAccountId, packageId, expectedUpdatedAt, input);
  } catch (error) {
    if (error instanceof AdminPackageError && error.code === "STALE_UPDATE") {
      redirect("/admin/packages?result=stale");
    }
    redirect("/admin/packages?result=error");
  }
  revalidatePath("/admin/packages");
  revalidatePath("/employer/packages");
  redirect("/admin/packages?result=updated");
}
