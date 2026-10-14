import { CrmWorkspace } from "../crm-workspace";
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <CrmWorkspace path={path ?? ["prospects"]} />;
}
