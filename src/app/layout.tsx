import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Modern sans
import "./globals.css";
import clsx from "clsx";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Study Temple | ITOP",
  description: "Advanced AI Study Platform for Ingeniería Técnica de Obras Públicas",
};

import { Sidebar } from "@/components/Sidebar";
import { ChatDock } from "@/components/ChatDock";

function getBuildInfo() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "";
  const ref = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_COMMIT_REF || "";
  const env = process.env.VERCEL_ENV || (process.env.VERCEL ? "vercel" : "local");
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || "";
  const shortSha = sha ? sha.slice(0, 7) : "unknown";
  const shortDeploy = deploymentId ? deploymentId.slice(0, 8) : "";

  return {
    label: `build ${shortSha}${ref ? ` · ${ref}` : ""}${shortDeploy ? ` · ${shortDeploy}` : ""} · ${env}`,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildInfo = getBuildInfo();

  return (
    <html lang="es-ES" className="dark">
      <body className={clsx(inter.className, "bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground")}>
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>

        <Sidebar />

        <main className="ml-72 min-h-screen relative">
          {children}
          <ChatDock />
        </main>

        <div className="fixed bottom-2 left-2 z-50 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-mono text-white/70 backdrop-blur">
          {buildInfo.label}
        </div>
      </body>
    </html>
  );
}
