import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "./dashboard-modern.css";
import "./office-modern.css";
import "./office-foundation.css";
import { SessionProvider } from "./session-provider";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = { title: "evflow", description: "Workspace operasional evflow" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="office-modern">
      <body className={`${jakarta.className} ${jakarta.variable}`}>
        <SessionProvider>{children}</SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
