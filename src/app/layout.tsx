import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND_DESCRIPTION_FA, BRAND_NAME_EN, BRAND_NAME_FA, getPublicOrigin } from "@/brand/identity";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicOrigin()),
  applicationName: BRAND_NAME_EN,
  title: {
    default: BRAND_NAME_FA,
    template: `%s | ${BRAND_NAME_FA}`,
  },
  description: BRAND_DESCRIPTION_FA,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME_FA,
    title: BRAND_NAME_FA,
    description: BRAND_DESCRIPTION_FA,
  },
  twitter: {
    card: "summary",
    title: BRAND_NAME_FA,
    description: BRAND_DESCRIPTION_FA,
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
