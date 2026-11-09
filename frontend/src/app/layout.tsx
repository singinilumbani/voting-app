import type { Metadata } from "next";
import { Commissioner } from "next/font/google";
import type { ReactNode } from "react";
import messages from "@/locales/en.json";
import { AppProviders } from "@/lib/query-provider";
import { SnackbarProvider } from "@/components/ui/dialogs";
import { OfflineBanner } from "@/components/global/OfflineBanner";
import { SessionExpiredDialog } from "@/components/global/SessionExpiredDialog";
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
      <body className="font-sans">
        <AppProviders>
          <SnackbarProvider>
            {children}
            <OfflineBanner />
            <SessionExpiredDialog />
          </SnackbarProvider>
        </AppProviders>
      </body>
    </html>
  );
}
