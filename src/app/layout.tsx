import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "جاب‌اوت",
    template: "%s | جاب‌اوت",
  },
  description: "جاب‌اوت؛ فضایی ساده برای نزدیک‌تر شدن کارجوها و فرصت‌های شغلی مرتبط.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
