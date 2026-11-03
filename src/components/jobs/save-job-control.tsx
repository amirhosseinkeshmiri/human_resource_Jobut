"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setCandidateJobSaved, type SavedJobActionState } from "@/saved-jobs/actions";
import { Button } from "@/components/ui";

function SubmitButton({ saved }: { saved: boolean }) {
  const { pending } = useFormStatus();
  return <Button
    type="submit"
    variant={saved ? "secondary" : "ghost"}
    size="small"
    loading={pending}
    aria-pressed={saved}
  >{pending ? "کمی صبر کنید…" : saved ? "حذف از ذخیره‌شده‌ها" : "ذخیره آگهی"}</Button>;
}

export function SaveJobControl({ jobPostId, initiallySaved }: { jobPostId: string; initiallySaved: boolean }) {
  const initialState: SavedJobActionState = { status: "idle", saved: initiallySaved };
  const [state, action] = useActionState(setCandidateJobSaved, initialState);
  return <div className="min-w-0">
    <form action={action}>
      <input type="hidden" name="jobPostId" value={jobPostId} />
      <input type="hidden" name="saved" value={state.saved ? "false" : "true"} />
      <SubmitButton saved={state.saved} />
    </form>
    {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`mt-1 text-xs ${state.status === "error" ? "text-danger" : "text-success"}`}>{state.message}</p> : null}
  </div>;
}
