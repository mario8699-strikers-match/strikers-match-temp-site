import { ManagersPageClient } from '@/components/ManagersPageClient';
import { getPublicManagersForPage } from '@/lib/seoData';

export const revalidate = 300;

export default async function ManagersPage() {
  const managers = await getPublicManagersForPage();
  return <ManagersPageClient initialManagers={managers} />;
}
