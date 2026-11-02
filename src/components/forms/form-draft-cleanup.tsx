"use client";

import { useEffect } from "react";
import { clearFormDraft, type FormDraftScope } from "@/forms/form-draft";

export function FormDraftCleanup({
  scopes,
  storage = "local",
}: {
  scopes: readonly FormDraftScope[];
  storage?: "local" | "session";
}) {
  useEffect(() => {
    const browserStorage = storage === "session" ? window.sessionStorage : window.localStorage;
    for (const scope of scopes) clearFormDraft(browserStorage, scope);
  }, [scopes, storage]);

  return null;
}
