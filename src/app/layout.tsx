import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "شبکه استخدامی متخصصین آکادمیک",
    template: "%s | شبکه استخدامی متخصصین آکادمیک",
  },
  description: "شبکه استخدامی متخصصین آکادمیک؛ همراه شما در جذب و استخدام.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
