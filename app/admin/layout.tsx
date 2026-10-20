import type { Metadata } from 'next';
import AdminShell from './AdminShell';

export const metadata: Metadata = {
  title: {
    default: '1F2 Admin Console',
    template: '%s | 1F2 Admin',
  },
  robots: 'noindex,nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
