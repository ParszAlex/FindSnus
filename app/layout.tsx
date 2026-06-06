import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MAP_BG } from "@/lib/mapStyle";
import "./globals.css";

// Runs before first paint: applies the stored theme (else system preference)
// to <html> and the theme-color meta, so a dark-mode visitor never sees a
// light flash. Keep in sync with THEME_STORAGE_KEY in ThemeProvider.
const themeInitScript = `(function(){try{var t=localStorage.getItem("findsnus:theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${MAP_BG.dark}");}}catch(e){}})()`;

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f6efd8",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://find-snus-imbg.vercel.app"),
  title: "findsnus — find UK shops that stock your nicotine pouches",
  description:
    "A cross-brand store locator for tobacco-free nicotine pouches in the UK. Enter a postcode to see which shops near you stock which brands, and at what price.",
  openGraph: {
    type: "website",
    title: "findsnus — find UK shops that stock your nicotine pouches",
    description:
      "A cross-brand store locator for tobacco-free nicotine pouches in the UK. Enter a postcode to see which shops near you stock which brands, and at what price.",
  },
  twitter: {
    card: "summary_large_image",
    title: "findsnus — find UK shops that stock your nicotine pouches",
    description:
      "A cross-brand store locator for tobacco-free nicotine pouches in the UK. Enter a postcode to see which shops near you stock which brands, and at what price.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "findsnus",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme script adds `.dark` to <html> before
    // React hydrates, so the class attribute legitimately differs from SSR.
    <html
      lang="en-GB"
      className={`${publicSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
