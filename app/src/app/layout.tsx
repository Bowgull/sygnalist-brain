import type { Metadata } from "next";
import { Toaster } from "sonner";
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
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "#171F28",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
