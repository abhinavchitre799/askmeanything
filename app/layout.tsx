import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskMeAnything — Admin",
  description: "Embeddable AI website Q&A widget admin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
