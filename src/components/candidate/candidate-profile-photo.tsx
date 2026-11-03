"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button, Card } from "@/components/ui";

const endpoint = "/api/candidate/profile-photo";

export function CandidateProfilePhotoAvatar({ version }: { version: string }) {
  const [available, setAvailable] = useState(true);
  if (!available) return null;
  return <Image
    src={`${endpoint}?v=${encodeURIComponent(version)}`}
    alt="تصویر پروفایل کارجو"
    width={64}
    height={64}
    unoptimized
    className="h-16 w-16 shrink-0 rounded-full border border-ui-border object-cover"
    onError={() => setAvailable(false)}
  />;
}

export function CandidateProfilePhoto({ initialPhotoVersion }: { initialPhotoVersion: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoVersion, setPhotoVersion] = useState(initialPhotoVersion);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const previewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : null, [selectedFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function upload() {
    if (!selectedFile) return;
    setPending(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("photo", selectedFile);
      const response = await fetch(endpoint, { method: "POST", body, credentials: "same-origin" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "ذخیره تصویر انجام نشد.");
      setPhotoVersion(String(Date.now()));
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ type: "success", text: result.message ?? "تصویر پروفایل ذخیره شد." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "ذخیره تصویر انجام نشد." });
    } finally { setPending(false); }
  }

  async function remove() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "حذف تصویر انجام نشد.");
      setPhotoVersion(null);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ type: "success", text: result.message ?? "تصویر پروفایل حذف شد." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حذف تصویر انجام نشد." });
    } finally { setPending(false); }
  }

  const displayedImage = previewUrl ?? (photoVersion ? `${endpoint}?v=${encodeURIComponent(photoVersion)}` : null);
  return <Card className="mb-6 shadow-none">
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui-border bg-surface-elevated text-3xl font-bold text-text-muted" aria-label={displayedImage ? "تصویر پروفایل کارجو" : "بدون تصویر پروفایل"}>
        {displayedImage ? <Image src={displayedImage} alt="تصویر پروفایل کارجو" width={112} height={112} unoptimized className="h-full w-full object-cover" onError={() => { if (!previewUrl) setPhotoVersion(null); }} /> : <span aria-hidden="true">ک</span>}
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-start">
        <h2 className="text-card-title">تصویر پروفایل</h2>
        <p className="text-helper mt-2">تصویر اختیاری است. JPEG، PNG یا WebP تا ۳ مگابایت؛ پس از ذخیره به تصویر مربع امن تبدیل می‌شود.</p>
        <label className="mt-4 block">
          <span className="sr-only">انتخاب تصویر پروفایل</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full max-w-md text-sm file:ms-0 file:me-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:border-ui-border file:bg-surface file:px-4 file:font-semibold"
            disabled={pending}
            onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setMessage(null); }}
          />
        </label>
        {message ? <p role={message.type === "error" ? "alert" : "status"} className={`mt-3 rounded-md border p-3 text-sm font-semibold ${message.type === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-success/5 text-success"}`}>{message.text}</p> : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" loading={pending} disabled={!selectedFile} onClick={upload}>ذخیره تصویر</Button>
          {photoVersion ? <Button type="button" variant="destructive" disabled={pending} onClick={remove}>حذف تصویر فعلی</Button> : null}
          {selectedFile ? <Button type="button" variant="ghost" disabled={pending} onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ""; }}>لغو انتخاب</Button> : null}
        </div>
      </div>
    </div>
  </Card>;
}
