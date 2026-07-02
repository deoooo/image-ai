import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image AI - Generate & Transform",
  description: "Generate images from text or transform existing images using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
