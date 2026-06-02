import type { Metadata } from "next";
import "./globals.css";

const themeBootstrapScript = `
  (() => {
    try {
      const stored = window.localStorage.getItem("sigo-theme-display");
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolved =
        stored === "dark" || stored === "light"
          ? stored
          : systemPrefersDark
            ? "dark"
            : "light";
      document.documentElement.dataset.sigoTheme = resolved;
    } catch (error) {
      document.documentElement.dataset.sigoTheme = "light";
    }
  })();
`;

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
    <html lang="pt" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
