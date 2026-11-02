"use server";

import { redirect } from "next/navigation";
import { destroyBrowserSessions } from "./browser-session";

export async function logoutBrowserAccount() {
  await destroyBrowserSessions();
  redirect("/");
}
