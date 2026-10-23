import { ItemWorkspace } from "../item-workspace";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <ItemWorkspace path={path ?? []} />;
}
