import "./globals.css";

export const metadata = {
  title: "StockSense | Warehouse & Inventory Management",
  description: "Modern enterprise inventory ERP — receipts, deliveries, stock ledger, and warehouse management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
