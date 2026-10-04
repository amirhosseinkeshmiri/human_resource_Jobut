import type { Metadata } from "next";
import { LoginPlaceholder } from "@/components/landing/login-placeholder";

export const metadata: Metadata = {
  title: "ورود کارجو",
};

export default function CandidateLoginPage() {
  return <LoginPlaceholder audience="کارجو" />;
}
