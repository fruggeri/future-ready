import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FutureReady | AI-Ready Family OS",
  description: "Raise children ready for the AI Era through weekly skill-building challenges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f7fbff]`}
      >
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-8 -left-8 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
          <div className="absolute bottom-8 -right-8 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
          <Image
            src="/decor/family-cloud.svg"
            alt=""
            width={360}
            height={180}
            className="absolute top-16 right-6 opacity-70"
            priority
          />
          <Image
            src="/decor/family-stars.svg"
            alt=""
            width={220}
            height={220}
            className="absolute bottom-12 left-4 opacity-60"
            priority
          />
        </div>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
