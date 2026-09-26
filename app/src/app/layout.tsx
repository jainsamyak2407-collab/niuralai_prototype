import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is a provisional match for the Niural app typeface (see DESIGN.md).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Payroll Readiness · Niural (rehearsal)",
  description: "Practice build with synthetic data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
