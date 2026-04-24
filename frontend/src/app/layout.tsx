import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import { PendingMatchingSync } from "@/components/sync/PendingMatchingSync";
import "./globals.css";

/** Dev: Turbopack/React иногда вызывает `performance.measure` с отрицательным end — гасим только этот сбой. */
const PERF_MEASURE_DEV_GUARD = `(function(){if(typeof performance==="undefined"||typeof performance.measure!="function")return;var n=performance.measure.bind(performance);performance.measure=function(){try{return n.apply(performance,arguments)}catch(e){var m=e&&e.message?String(e.message):"";if(m.indexOf("end cannot be negative")>=0||m.indexOf("negative time stamp")>=0||m.indexOf("cannot have a negative time stamp")>=0)return;throw e}}})();`;

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
      <body className="min-h-full flex flex-col bg-neutral-100 font-[var(--font-inter)] tracking-[-0.011em] dark:bg-neutral-950">
        {process.env.NODE_ENV === "development" ? (
          <Script
            id="edulab-perf-measure-dev-guard"
            strategy="beforeInteractive"
          >
            {PERF_MEASURE_DEV_GUARD}
          </Script>
        ) : null}
        <PendingMatchingSync />
        {children}
      </body>
    </html>
  );
}
