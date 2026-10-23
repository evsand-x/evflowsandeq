import { SupplierWorkspace } from "../supplier-workspace";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <SupplierWorkspace path={path ?? []} />;
}
