import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PICKAPP — Social commerce con IA",
  description: "Crea tu tienda, vende con un asistente comercial y automatiza pedidos e inventario.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const useClerk = env.authMode === "clerk" && Boolean(publicEnv.clerkPublishableKey);
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {useClerk ? <ClerkProvider publishableKey={publicEnv.clerkPublishableKey}>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
