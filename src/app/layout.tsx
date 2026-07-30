import type { Metadata } from "next";
import { Figtree, JetBrains_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";

// Design system (design-system/roslanner/MASTER.md): Figtree for headings,
// Noto Sans for body — medical, clean, accessible.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roslanner",
  description: "Constraint-based medical roster planning per ward",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${notoSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
