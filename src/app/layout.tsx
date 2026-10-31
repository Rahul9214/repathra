import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, IBM_Plex_Mono, Outfit } from "next/font/google";

import { StudioShell } from "@/components/studio/chrome";
import { PRODUCT } from "@/shared/contracts/product";
import { readClerkConfig } from "@/shared/config/clerk";

import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const ui = Outfit({
  subsets: ["latin"],
  variable: "--font-ui",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: `${PRODUCT.name} · Journey Studio`,
  description: PRODUCT.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const clerk = readClerkConfig(process.env);
  const shell = <StudioShell>{children}</StudioShell>;

  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">
        {clerk.configured ? <ClerkProvider>{shell}</ClerkProvider> : shell}
      </body>
    </html>
  );
}
