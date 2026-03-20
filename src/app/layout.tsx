import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";

import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LAP1 Log Analyse",
  description: "Upload, Auswertung und erste Kennzahlen für LAP1-PdbWizard-Logs",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={openSans.className}>{children}</body>
    </html>
  );
}
