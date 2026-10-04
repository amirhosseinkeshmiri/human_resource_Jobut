import type { Metadata } from "next";
import { LoginPlaceholder } from "@/components/landing/login-placeholder";

export const metadata: Metadata = {
  title: "ورود کارفرما",
};

export default function EmployerLoginPage() {
  return <LoginPlaceholder audience="کارفرما" />;
}
