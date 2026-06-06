import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
