import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "../globals.css";

// The panel sits outside `[locale]` — it is a Greek-only internal tool and
// `proxy.ts` exempts it from locale rewriting — so it needs its own root
// layout. The customer-facing `<html>` lives in `[locale]/layout.tsx`.

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "greek"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Διαχείριση — Casa Playa",
  // A staff tool has no business in a search index, gate or no gate.
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-100">{children}</body>
    </html>
  );
}
