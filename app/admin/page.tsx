import { redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/lib/auth/auth';

export default async function AdminRootPage() {
  const admin = await getAuthenticatedAdmin();

  if (admin) {
    redirect('/admin/dashboard');
  } else {
    redirect('/admin/login');
  }
}

