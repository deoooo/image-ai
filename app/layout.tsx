import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Image AI - Generate & Transform",
  description: "Generate images from text or transform existing images using AI.",
};

import { AuthGate } from "@/components/AuthGate";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "bg-gray-50 min-h-screen")}>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
