import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Sygnalist - Find the Signal",
  description: "Job hunt engine and coaching platform",
  manifest: "/manifest.json",
  themeColor: "#0C1016",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sygnalist",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-[#0C1016] font-sans text-white antialiased">
        {children}
        <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "#171F28", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" } }} />
      </body>
    </html>
  );
}
