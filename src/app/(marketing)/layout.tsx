import React from "react";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-950 text-white selection:bg-teal-500/30">
      {children}
    </div>
  );
}
