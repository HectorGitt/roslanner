import React from "react";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-white text-zinc-900 selection:bg-emerald-500/20">
      {children}
    </div>
  );
}
