"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { requireOwnerOnlyOperation } from "@/admin-auth/rbac-guards";
import { parseAdminPackageInput } from "@/admin/package-policy";
import {
  AdminPackageError,
  createAdminPackage,
  deleteAdminPackage,
  updateAdminPackage,
} from "@/admin/packages";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeMutation() {
  if (!(await inspectTrustedAuthActionRequest()).trusted) notFound();
  return requireOwnerOnlyOperation("admin.packages.manage");
}

function parseVersion(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? parsed : null;
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
  revalidatePath("/");
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
  const expectedUpdatedAt = parseVersion(rawUpdatedAt);
  if (!expectedUpdatedAt) redirect("/admin/packages?result=invalid");
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
  revalidatePath("/");
  redirect("/admin/packages?result=updated");
}

export async function deletePackageAction(formData: FormData) {
  const owner = await authorizeMutation();
  const packageId = formData.get("packageId");
  const expectedUpdatedAt = parseVersion(formData.get("updatedAt"));
  const confirmedName = formData.get("confirmedName");
  if (
    typeof packageId !== "string"
    || !UUID_PATTERN.test(packageId)
    || !expectedUpdatedAt
    || typeof confirmedName !== "string"
  ) redirect("/admin/packages?result=delete-invalid");
  try {
    await deleteAdminPackage(
      owner.adminAccountId,
      packageId,
      expectedUpdatedAt,
      confirmedName,
    );
  } catch (error) {
    if (error instanceof AdminPackageError) {
      if (error.code === "DELETE_BLOCKED") redirect("/admin/packages?result=delete-blocked");
      if (error.code === "CONFIRMATION_MISMATCH") redirect("/admin/packages?result=delete-confirmation");
      if (error.code === "STALE_UPDATE") redirect("/admin/packages?result=delete-stale");
      if (error.code === "NOT_FOUND") redirect("/admin/packages?result=delete-missing");
    }
    redirect("/admin/packages?result=delete-error");
  }
  revalidatePath("/admin/packages");
  revalidatePath("/employer/packages");
  revalidatePath("/");
  redirect("/admin/packages?result=deleted");
}
