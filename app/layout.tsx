import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import { cssDoTemaApp } from "@/lib/temaApp";
import { NOME, TITULO, DESCRICAO } from "@/lib/marca";

// Uma letra só no app inteiro (antes eram Inter no corpo e Sora nos títulos,
// e a página do nutricionista tinha uma terceira instância própria). Instrument
// Sans só vai de 400 a 700: um `font-extrabold` cai no 700, sem peso sintético.
const letra = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  manifest: "/manifest.webmanifest",
  applicationName: NOME,
  appleWebApp: {
    capable: true,
    title: NOME,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e5d34",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={letra.variable}>
      <head>
        {/* As variáveis --app-* saem da mesma tabela que o teste de contraste
            confere (lib/temaApp.ts); não há segunda lista em globals.css. */}
        <style dangerouslySetInnerHTML={{ __html: cssDoTemaApp() }} />
      </head>
      <body className="font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
