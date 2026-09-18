import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { buildPlatformIcons, resolveFaviconUrl } from "@saasclinics/lib";
import { getPlatformBranding } from "@/lib/platform-branding";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["600", "700", "800"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding();
  const title = `${branding.product_name} — Clinic Software`;
  const metadataBase = new URL(
    (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  );
  return {
    metadataBase,
    title: { default: title, template: `%s · ${branding.product_name}` },
    description: "Veterinary clinic operations — appointments, records, pharmacy, and payments.",
    icons: buildPlatformIcons(resolveFaviconUrl(branding)),
    robots: { index: false, follow: false },
  };
}

const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-48x48.png" type="image/png" sizes="48x48" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="preload" as="style" href={MATERIAL_SYMBOLS_HREF} />
        <link id="material-symbols" rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} media="print" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.getElementById('material-symbols');if(!l)return;var a=function(){l.media='all'};if(l.sheet)a();else l.addEventListener('load',a);})();`,
          }}
        />
        <noscript>
          <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
        </noscript>
      </head>
      <body className={`${inter.variable} ${manrope.variable} bg-surface text-on-background antialiased`}>
        {children}
      </body>
    </html>
  );
}
