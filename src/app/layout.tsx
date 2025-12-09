import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Modern sans
import "./globals.css";
import clsx from "clsx";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Study Temple | ITOP",
  description: "Advanced AI Study Platform for Ingeniería Técnica de Obras Públicas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-ES" className="dark">
      <body className={clsx(inter.className, "bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground")}>
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        {children}
      </body>
    </html>
  );
}
