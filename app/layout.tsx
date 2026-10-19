import { Geist_Mono, Inter } from "next/font/google";

import type { Metadata, Viewport } from "next";

import "./globals.css";

import AppHeader from "@/components/matrix/app-header";
import { MatrixProvider } from "@/components/matrix/matrix-context";
import Providers from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Git Branch Matrix",
  description: "Track tickets against environments, straight from git",
};

export const viewport: Viewport = {
  themeColor: "#0EA5E9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <Providers>
          <TooltipProvider>
            <MatrixProvider>
              <AppHeader />
              <main>{children}</main>
            </MatrixProvider>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
