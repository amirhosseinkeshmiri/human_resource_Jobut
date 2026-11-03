"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function ResumePdfDownload({ filename }: { filename: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function download() {
    setState("loading");
    try {
      const response = await fetch("/api/candidate/resume/pdf", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/pdf" },
      });
      if (!response.ok || response.headers.get("content-type") !== "application/pdf") throw new Error("DOWNLOAD_FAILED");
      const blob = await response.blob();
      if (!blob.size) throw new Error("EMPTY_DOWNLOAD");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return <div className="min-w-0">
    <Button type="button" variant="primary" size="small" className="min-h-11 w-full sm:w-auto" loading={state === "loading"} onClick={download}>
      {state === "loading" ? "در حال ساخت PDF…" : "دانلود رزومه PDF"}
    </Button>
    {state === "success" ? <p role="status" className="mt-2 text-sm font-medium text-success">فایل رزومه برای دانلود آماده شد.</p> : null}
    {state === "error" ? <p role="alert" className="mt-2 text-sm font-medium text-danger">ساخت فایل PDF انجام نشد. دوباره تلاش کنید.</p> : null}
  </div>;
}
