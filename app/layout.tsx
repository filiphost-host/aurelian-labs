import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurelian Capital",
  description: "Independent market intelligence, global analysis, and portfolio stress testing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
