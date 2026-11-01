"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { isAdminPermission } from "@/admin-auth/permissions";
import { isAdminManagementEnabled } from "@/admin-auth/admin-management-feature";
import { requireSuperAdmin } from "@/admin-auth/rbac-guards";
import {
  createOrdinaryAdminAccount,
  disableAdminAccount,
  enableAdminAccount,
  grantAdminPermission,
  revokeAdminPermission,
} from "@/admin-auth/rbac-service";

async function authorizeMutation() {
  if (!isAdminManagementEnabled()) notFound();
  if (!(await inspectTrustedAuthActionRequest()).trusted) notFound();
  return requireSuperAdmin();
}

function uuid(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export async function createAdminAccountAction(formData: FormData) {
  const owner = await authorizeMutation();
  const identifier = formData.get("identifier");
  if (typeof identifier !== "string") notFound();
  try {
    await createOrdinaryAdminAccount(owner.adminAccountId, identifier);
  } catch {
    redirect("/admin/admins?result=create-error");
  }
  revalidatePath("/admin/admins");
  redirect("/admin/admins?result=created");
}

export async function updateAdminPermissionAction(formData: FormData) {
  const owner = await authorizeMutation();
  const targetId = uuid(formData.get("adminAccountId"));
  const permission = formData.get("permission");
  const operation = formData.get("operation");
  if (!targetId || !isAdminPermission(permission) || (operation !== "grant" && operation !== "revoke")) {
    notFound();
  }
  if (operation === "grant") {
    await grantAdminPermission(owner.adminAccountId, targetId, permission);
  } else {
    await revokeAdminPermission(owner.adminAccountId, targetId, permission);
  }
  revalidatePath("/admin/admins");
}

export async function updateAdminStatusAction(formData: FormData) {
  const owner = await authorizeMutation();
  const targetId = uuid(formData.get("adminAccountId"));
  const operation = formData.get("operation");
  if (!targetId || (operation !== "enable" && operation !== "disable")) notFound();
  if (operation === "disable") {
    const reason = formData.get("reason");
    if (typeof reason !== "string") notFound();
    await disableAdminAccount(owner.adminAccountId, targetId, reason);
  } else {
    await enableAdminAccount(owner.adminAccountId, targetId);
  }
  revalidatePath("/admin/admins");
}
