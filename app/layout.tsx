import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUDIT — Find What's Slowing Down Your Website",
  description:
    "AUDIT analyzes your website performance, finds the resources causing slowdowns, and gives you a prioritized list of fixes.",
  openGraph: {
    title: "AUDIT — Find What's Slowing Down Your Website",
    description:
      "AUDIT analyzes your website performance, finds the resources causing slowdowns, and gives you a prioritized list of fixes.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AUDIT — Find What's Slowing Down Your Website",
    description: "Find what's slowing your website down.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('audit-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{
          fontFamily:
            'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
