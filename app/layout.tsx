import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppBadge } from "@/components/app-badge";
import { SwRegister } from "@/components/sw-register";
import { OfflinePrefetcher } from "@/components/offline-prefetcher";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "420er Rangliste",
  description: "DSV-Ranglistensystem für die 420er-Klasse",
  // PWA / iOS home-screen tuning — uses the actual logo as app icon.
  appleWebApp: {
    capable: true,
    title: "420er Rangliste",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: import("next").Viewport = {
  // Maritime blue — matches header gradient and manifest theme_color.
  themeColor: "#1B3C8E",
};

/**
 * Read the resolved theme from the cookie set by ThemeProvider.
 * The cookie always stores "light" or "dark" (the resolved value — never
 * "system"), so the server can apply the correct class without a script.
 * Falls back to "light" for first-time visitors (no cookie yet).
 */
async function getServerTheme(): Promise<"light" | "dark"> {
  try {
    const store = await cookies();
    const value = store.get("theme-resolved")?.value;
    return value === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-side theme: avoids any inline <script> in the React tree.
  // React 19 warns about every inline <script> inside a React component
  // (including layout Server Components) because the element goes through
  // React's client reconciler during hydration and React refuses to
  // re-execute it.  The cookie approach is cleaner: the server already
  // knows the user's preference, so it can render the correct class on
  // <html> from the very first byte — no JavaScript needed for FOUC prevention.
  const serverTheme = await getServerTheme();

  return (
    <html
      lang="de"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased ${serverTheme}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppBadge />
          <SwRegister />
          <OfflinePrefetcher />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
