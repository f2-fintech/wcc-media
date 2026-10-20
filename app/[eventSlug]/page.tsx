import { redirect } from 'next/navigation';

export default async function EventRootPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  redirect(`/${eventSlug}/gallery`);
}
