import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "PrepWise",
  title: { default: "PrepWise — Practice with purpose", template: "%s | PrepWise" },
  description:
    "Prepare for your next opportunity with role-based AI video interviews, adaptive questions, and answer feedback.",
  openGraph: {
    siteName: "PrepWise",
    title: "PrepWise — Practice with purpose",
    description: "Tailored interview questions and real-time voice practice for your next opportunity.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        {children}

        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
