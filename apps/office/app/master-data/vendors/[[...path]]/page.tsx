import { VendorWorkspace } from "../vendor-workspace";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <VendorWorkspace path={path ?? []} />;
}
