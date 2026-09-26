import "./globals.css";

export const metadata = {
  title: "StockSense",
  description: "StockSense inventory management — receipts, deliveries, stock, move history",
};

export default function RootLayout({ children }) {
  return (
      <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
