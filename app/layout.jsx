import Script from "next/script";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const titulo = Cormorant_Garamond({ subsets: ["latin"], weight: ["500"], variable: "--fonte-titulo", display: "swap" });
const texto = Figtree({ subsets: ["latin"], variable: "--fonte-texto", display: "swap" });

export const metadata = {
  title: "Avaliação Sob Medida · Clínica Alma",
  description: "Responda 6 perguntas rápidas e garanta sua avaliação gratuita na Clínica Alma, em Cascavel-PR.",
  robots: { index: false },
};

// Lê META_PIXEL_ID e WHATSAPP_NUMERO a cada acesso (e não só no build),
// para uma variável trocada na Netlify valer sem depender da ordem do deploy.
export const dynamic = "force-dynamic";

export const viewport ={ width: "device-width", initialScale: 1, themeColor: "#2D1910" };

const pixelId = process.env.META_PIXEL_ID || "";

const pixel = `if(!location.pathname.startsWith('/painel')){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');}`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body>
        {pixelId ? <Script id="meta-pixel" strategy="afterInteractive">{pixel}</Script> : null}
        {children}
      </body>
    </html>
  );
}
