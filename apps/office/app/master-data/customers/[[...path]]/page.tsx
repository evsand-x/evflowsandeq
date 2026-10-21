import { CustomerWorkspace } from "../customer-workspace";
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <CustomerWorkspace path={path ?? []} />;
}
