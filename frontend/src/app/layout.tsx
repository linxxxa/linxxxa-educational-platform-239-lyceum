import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { PageWrapper } from "@/components/layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ФМЛ 239 — Адаптивное обучение",
  description: "Интеллектуальная система адаптивного обучения для физики",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[var(--font-inter)] tracking-[-0.011em]">
        <PageWrapper>{children}</PageWrapper>
      </body>
    </html>
  );
}
