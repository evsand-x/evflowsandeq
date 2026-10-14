import { CrmWorkspace } from "../../../crm/crm-workspace";
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return <CrmWorkspace path={["customers", ...(path ?? [])]} />;
}
