import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurelian Labs",
  description: "Private portfolio workbench for scenario analysis and investment theses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
