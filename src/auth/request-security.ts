import "server-only";
import { headers } from "next/headers";
import { isExpectedAuthOrigin } from "./origin-policy";

export async function isTrustedAuthActionRequest() {
  if (process.env.NODE_ENV !== "production") return true;
  return isExpectedAuthOrigin(
    (await headers()).get("origin"),
    process.env.APP_URL,
  );
}
