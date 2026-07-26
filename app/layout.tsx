import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TechLabs Inventory',
  description: 'Upload a file or Google Sheet, normalize it with an LLM agent, and ingest inventory into Supabase.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
