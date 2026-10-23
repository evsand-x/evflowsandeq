import { WarehouseWorkspace } from "../warehouse-workspace";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <WarehouseWorkspace path={path ?? []} />;
}
