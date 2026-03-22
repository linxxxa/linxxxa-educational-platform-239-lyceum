import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageWrapper>{children}</PageWrapper>
      </body>
    </html>
  );
}
