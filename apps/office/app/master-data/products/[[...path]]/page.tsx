import { ProductWorkspace } from "../product-workspace";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <ProductWorkspace path={path ?? []} />;
}
