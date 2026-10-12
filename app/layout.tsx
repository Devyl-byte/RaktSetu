import type { Metadata } from "next";
import "./globals.css";
import "./reference-walkthrough.css";
import "./workspace-reference-theme.css";

export const metadata: Metadata = {
  title: "RaktSetu MVP — Blood Donor Coordination",
  description:
    "Synthetic-data demonstration of safe, controlled blood donor coordination across participating hospitals.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
