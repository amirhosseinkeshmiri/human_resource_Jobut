import { randomUUID } from "node:crypto";
import { Button, Card, FormField, Select, Textarea } from "@/components/ui";
import { messageKindLabel, messageSenderLabel, type ApplicationMessageRole } from "./policy";

type Message = { id: string; senderRole: ApplicationMessageRole; kind: "recruitment_message" | "interview_invitation"; body: string; createdAt: Date; readAt: Date | null };
const formatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });

export function ApplicationMessageThread(props: {
  applicationId: string;
  jobId?: string;
  viewerRole: ApplicationMessageRole;
  messages: Message[];
  canSend: boolean;
  outcome?: string;
  sendAction: (formData: FormData) => Promise<void>;
  markReadAction: (formData: FormData) => Promise<void>;
}) {
  const unread = props.messages.filter((message) => message.senderRole !== props.viewerRole && !message.readAt).length;
  const outcome = props.outcome === "sent" ? { role: "status", text: "پیام ثبت شد." } : props.outcome === "validation" ? { role: "alert", text: "متن پیام باید بین ۲ تا ۲۰۰۰ نویسه باشد." } : props.outcome === "rate" ? { role: "alert", text: "تعداد پیام‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." } : props.outcome === "duplicate" ? { role: "alert", text: "این پیام به‌تازگی ثبت شده است." } : props.outcome === "unavailable" ? { role: "alert", text: "ارسال پیام برای این درخواست در دسترس نیست." } : props.outcome === "error" ? { role: "alert", text: "ثبت پیام موقتاً انجام نشد. دوباره تلاش کنید." } : null;
  return <Card id="messages" className="mt-5 scroll-mt-24 shadow-none">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-section-title">گفت‌وگوی جذب</h2><p className="text-helper mt-2">این گفت‌وگو فقط برای همین درخواست شغلی و بدون نمایش اطلاعات تماس است.</p></div>{unread ? <form action={props.markReadAction}><input type="hidden" name="applicationId" value={props.applicationId} />{props.jobId ? <input type="hidden" name="jobId" value={props.jobId} /> : null}<Button type="submit" variant="secondary" size="small">خواندم ({unread})</Button></form> : null}</div>
    {outcome ? <p role={outcome.role} className="mt-4 rounded-md border border-ui-border p-3 text-sm">{outcome.text}</p> : null}
    {props.messages.length ? <ol className="mt-5 grid gap-3" aria-label="پیام‌های این درخواست">{props.messages.map((message) => { const own = message.senderRole === props.viewerRole; return <li key={message.id} className={`max-w-[90%] rounded-lg border p-4 ${own ? "ms-auto border-action/20 bg-action/5" : "me-auto border-ui-border bg-surface-elevated"}`}><div className="flex flex-wrap items-center gap-2"><span className="text-label">{own ? "شما" : messageSenderLabel(message.senderRole)}</span><span className="text-meta">{messageKindLabel(message.kind)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{message.body}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted"><time dateTime={message.createdAt.toISOString()}>{formatter.format(message.createdAt)}</time>{own ? <span>{message.readAt ? `خوانده‌شده ${formatter.format(message.readAt)}` : "تحویل‌شده"}</span> : null}</div></li>; })}</ol> : <p className="text-secondary mt-5">هنوز پیامی برای این درخواست ثبت نشده است.</p>}
    {props.canSend ? <form action={props.sendAction} className="mt-6 grid gap-4 border-t border-ui-border pt-5"><input type="hidden" name="applicationId" value={props.applicationId} /><input type="hidden" name="idempotencyKey" value={randomUUID()} />{props.jobId ? <input type="hidden" name="jobId" value={props.jobId} /> : null}{props.viewerRole === "employer" ? <FormField id="message-kind" label="نوع پیام"><Select id="message-kind" name="kind" defaultValue="recruitment_message"><option value="recruitment_message">پیام جذب</option><option value="interview_invitation">دعوت به مصاحبه</option></Select></FormField> : null}<FormField id={`${props.viewerRole}-message-body`} label="متن پیام" hint="حداکثر ۲۰۰۰ نویسه؛ اطلاعات تماس یا داده حساس ارسال نکنید."><Textarea id={`${props.viewerRole}-message-body`} name="body" required minLength={2} maxLength={2000} rows={5} /></FormField><Button type="submit" className="w-full sm:w-fit">ارسال پیام</Button></form> : <p className="text-helper mt-5 border-t border-ui-border pt-4">این گفت‌وگو فقط قابل مشاهده است و پیام جدید پذیرفته نمی‌شود.</p>}
  </Card>;
}
