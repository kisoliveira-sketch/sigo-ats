import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGO-ATS",
  description: "Sistema Integrado de Gestão Operacional - ATS",
  icons: {
    icon: "/icon.png?v=2",
    shortcut: "/icon.png?v=2",
    apple: "/icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className="antialiased">{children}</body>
    </html>
  );
}
