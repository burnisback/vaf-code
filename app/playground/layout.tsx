'use client';

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-theme">
      {children}
    </div>
  );
}
