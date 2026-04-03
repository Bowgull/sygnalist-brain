import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sygnalist — Find the Signal",
  description: "Job hunt engine and coaching platform",
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
      </body>
    </html>
  );
}
