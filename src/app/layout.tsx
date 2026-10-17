import type { Metadata } from "next";
import { Outfit, Inter, Caveat } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Havoc RC Funzone & Miniature World",
  description: "Bengaluru's ultimate destination for RC racing, drones, miniature trains and immersive hobby experiences.",
  icons: {
    icon: "/havoc_logo.png",
    shortcut: "/havoc_logo.png",
    apple: "/havoc_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${inter.variable} ${caveat.variable} font-sans antialiased bg-[#f8f9fa] text-[#0d1b2a] min-h-screen flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
