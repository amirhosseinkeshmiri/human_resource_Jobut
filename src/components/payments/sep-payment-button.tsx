"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

interface SepPaymentButtonProps {
  purchaseId: string;
}

function isTrustedSepRedirect(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === "https://sep.shaparak.ir" &&
      url.pathname === "/OnlinePG/SendToken" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      Boolean(url.searchParams.get("token"))
    );
  } catch {
    return false;
  }
}

export function SepPaymentButton({ purchaseId }: SepPaymentButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPayment() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/sep/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchaseId }),
        credentials: "same-origin",
      });
      const body = await response.json() as {
        redirectUrl?: unknown;
        receiptUrl?: unknown;
        message?: unknown;
      };
      if (!response.ok) {
        throw new Error(typeof body.message === "string" ? body.message : "آغاز پرداخت انجام نشد.");
      }
      if (typeof body.receiptUrl === "string") {
        const receipt = new URL(body.receiptUrl, window.location.origin);
        if (receipt.origin !== window.location.origin) throw new Error("نشانی رسید معتبر نیست.");
        window.location.assign(receipt.toString());
        return;
      }
      if (typeof body.redirectUrl !== "string" || !isTrustedSepRedirect(body.redirectUrl)) {
        throw new Error("نشانی درگاه پرداخت معتبر نیست.");
      }
      window.location.assign(body.redirectUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "آغاز پرداخت انجام نشد.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button type="button" className="w-full sm:w-auto" loading={pending} onClick={startPayment}>
        {pending ? "در حال اتصال به درگاه…" : "پرداخت با درگاه سامان"}
      </Button>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
