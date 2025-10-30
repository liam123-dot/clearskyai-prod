import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Clearsky AI",
    default: "Clearsky AI",
  },
  description: "AI-powered voice agents for your business. Create, manage, and deploy intelligent voice assistants.",
  openGraph: {
    title: "Clearsky AI",
    description: "AI-powered voice agents for your business. Create, manage, and deploy intelligent voice assistants.",
    images: [
      {
        url: "/clearsky_ai_icon_color.png",
        width: 1200,
        height: 630,
        alt: "Clearsky AI",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clearsky AI",
    description: "AI-powered voice agents for your business. Create, manage, and deploy intelligent voice assistants.",
    images: ["/clearsky_ai_icon_color.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
