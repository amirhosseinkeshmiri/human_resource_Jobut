"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FormField, Input, Select, Textarea } from "@/components/ui";
import {
  credentialRecordTypeLabels,
  credentialRecordTypes,
  type CandidateCredentialInput,
} from "@/candidate-credentials/validation";

export interface CandidateCredentialView extends CandidateCredentialInput {
  id: string;
  hasDocument: boolean;
}

const emptyRecord: CandidateCredentialInput = {
  recordType: "certificate",
  title: "",
  issuer: "",
  issueDate: "",
  expirationDate: "",
  credentialId: "",
  verificationUrl: "",
  description: "",
};

export function CandidateCredentialsManager({ initialRecords }: { initialRecords: CandidateCredentialView[] }) {
  const router = useRouter();
  const records = initialRecords;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<CandidateCredentialInput>(emptyRecord);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function field<K extends keyof CandidateCredentialInput>(name: K, value: CandidateCredentialInput[K]) {
    setValues((current) => ({ ...current, [name]: value }));
  }
  function edit(record: CandidateCredentialView) {
    setEditingId(record.id);
    setValues({
      recordType: record.recordType,
      title: record.title,
      issuer: record.issuer,
      issueDate: record.issueDate ?? "",
      expirationDate: record.expirationDate ?? "",
      credentialId: record.credentialId ?? "",
      verificationUrl: record.verificationUrl ?? "",
      description: record.description ?? "",
    });
    setMessage(null);
  }
  function resetForm() { setEditingId(null); setValues(emptyRecord); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setMessage(null);
    try {
      const url = editingId ? `/api/candidate/credentials/${editingId}` : "/api/candidate/credentials";
      const response = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values), credentials: "same-origin" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "ذخیره سابقه انجام نشد.");
      setMessage({ type: "success", text: result.message ?? "سابقه ذخیره شد." });
      resetForm();
      router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "ذخیره سابقه انجام نشد." }); }
    finally { setPending(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("این سابقه و تصویر مدرک آن حذف شود؟")) return;
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/candidate/credentials/${id}`, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "حذف سابقه انجام نشد.");
      setMessage({ type: "success", text: result.message ?? "سابقه حذف شد." });
      router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "حذف سابقه انجام نشد." }); }
    finally { setPending(false); }
  }

  async function uploadDocument(id: string, form: HTMLFormElement) {
    const body = new FormData(form);
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/candidate/credentials/${id}/document`, { method: "POST", body, credentials: "same-origin" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "ذخیره تصویر مدرک انجام نشد.");
      setMessage({ type: "success", text: result.message ?? "تصویر مدرک ذخیره شد." });
      form.reset(); router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "ذخیره تصویر مدرک انجام نشد." }); }
    finally { setPending(false); }
  }

  async function removeDocument(id: string) {
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/candidate/credentials/${id}/document`, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "حذف تصویر مدرک انجام نشد.");
      setMessage({ type: "success", text: result.message ?? "تصویر مدرک حذف شد." }); router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "حذف تصویر مدرک انجام نشد." }); }
    finally { setPending(false); }
  }

  return <section className="mt-6 grid gap-6" aria-labelledby="candidate-credentials-heading">
    <Card className="shadow-none">
      <h2 id="candidate-credentials-heading" className="text-section-title">گواهی‌ها و دوره‌های آموزشی</h2>
      <p className="text-helper mt-2">تحصیلات رسمی در بخش تحصیلات باقی می‌ماند. این بخش برای دوره‌ها و گواهی‌های حرفه‌ای است و ثبت آن به معنی تأیید مستقل JobUT نیست.</p>
      {message ? <p role={message.type === "error" ? "alert" : "status"} className={`mt-4 rounded-md border p-3 text-sm font-semibold ${message.type === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-success/5 text-success"}`}>{message.text}</p> : null}
      <form onSubmit={save} className="mt-5 grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="credential-type" label="نوع سابقه" required><Select id="credential-type" value={values.recordType} onChange={(event) => field("recordType", event.target.value as CandidateCredentialInput["recordType"])}>{credentialRecordTypes.map((type) => <option key={type} value={type}>{credentialRecordTypeLabels[type]}</option>)}</Select></FormField>
          <FormField id="credential-title" label="عنوان" required><Input id="credential-title" value={values.title} onChange={(event) => field("title", event.target.value)} maxLength={200} /></FormField>
          <FormField id="credential-issuer" label="سازمان صادرکننده / برگزارکننده" required><Input id="credential-issuer" value={values.issuer} onChange={(event) => field("issuer", event.target.value)} maxLength={200} /></FormField>
          <FormField id="credential-code" label="شناسه گواهی"><Input id="credential-code" value={values.credentialId ?? ""} onChange={(event) => field("credentialId", event.target.value)} maxLength={200} dir="auto" /></FormField>
          <FormField id="credential-issue-date" label="تاریخ صدور / پایان دوره"><Input id="credential-issue-date" type="date" dir="ltr" value={values.issueDate ?? ""} onChange={(event) => field("issueDate", event.target.value)} /></FormField>
          <FormField id="credential-expiration-date" label="تاریخ انقضا (اختیاری)"><Input id="credential-expiration-date" type="date" dir="ltr" value={values.expirationDate ?? ""} onChange={(event) => field("expirationDate", event.target.value)} /></FormField>
          <FormField id="credential-url" label="لینک اعتبارسنجی"><Input id="credential-url" type="url" dir="ltr" value={values.verificationUrl ?? ""} onChange={(event) => field("verificationUrl", event.target.value)} maxLength={2000} /></FormField>
        </div>
        <FormField id="credential-description" label="توضیحات یا مهارت‌های کسب‌شده"><Textarea id="credential-description" value={values.description ?? ""} onChange={(event) => field("description", event.target.value)} rows={3} maxLength={1000} /></FormField>
        <div className="flex flex-col gap-2 sm:flex-row"><Button type="submit" loading={pending}>{editingId ? "ذخیره ویرایش" : "افزودن سابقه"}</Button>{editingId ? <Button type="button" variant="ghost" disabled={pending} onClick={resetForm}>لغو ویرایش</Button> : null}</div>
      </form>
    </Card>
    <Card className="shadow-none"><h2 className="text-card-title">سوابق ثبت‌شده</h2>{records.length ? <div className="mt-5 grid gap-4">{records.map((record) => <article key={record.id} className="rounded-lg border border-ui-border p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><p className="text-meta">{credentialRecordTypeLabels[record.recordType]}</p><h3 className="mt-1 break-words font-bold" dir="auto">{record.title}</h3><p className="text-secondary mt-1 break-words" dir="auto">{record.issuer}</p>{record.description ? <p className="text-body mt-3 whitespace-pre-wrap break-words text-text-secondary">{record.description}</p> : null}</div><div className="flex shrink-0 gap-2"><Button type="button" size="small" variant="secondary" disabled={pending} onClick={() => edit(record)}>ویرایش</Button><Button type="button" size="small" variant="ghost" className="text-danger" disabled={pending} onClick={() => remove(record.id)}>حذف</Button></div></div><div className="mt-4 border-t border-ui-border pt-4"><p className="text-helper">تصویر مدرک اختیاری و خصوصی است؛ فایل PDF فعلاً پذیرفته نمی‌شود.</p>{record.hasDocument ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><a href={`/api/candidate/credentials/${record.id}/document`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-action">مشاهده تصویر مدرک</a><Button type="button" size="small" variant="ghost" className="text-danger" disabled={pending} onClick={() => removeDocument(record.id)}>حذف تصویر</Button></div> : null}<form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(event) => { event.preventDefault(); void uploadDocument(record.id, event.currentTarget); }}><input name="document" type="file" accept="image/jpeg,image/png,image/webp" required disabled={pending} className="min-w-0 text-sm" /><Button type="submit" size="small" variant="secondary" loading={pending}>{record.hasDocument ? "جایگزینی تصویر" : "افزودن تصویر مدرک"}</Button></form></div></article>)}</div> : <p className="text-secondary mt-4">هنوز گواهی یا دوره‌ای ثبت نشده است.</p>}</Card>
  </section>;
}
