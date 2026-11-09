import type { Metadata } from "next";
import { Commissioner } from "next/font/google";
import type { ReactNode } from "react";
import messages from "@/locales/en.json";
import "../styles/globals.css";

const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: messages.metadata.title,
  description: messages.metadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={commissioner.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
