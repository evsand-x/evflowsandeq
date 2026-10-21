import { CrmWorkspace } from "../crm-workspace";
import { redirect } from "next/navigation";
import { OpportunityWorkspace } from "../opportunity-workspace";
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  if (path?.[0] === "customers")
    redirect(
      `/master-data/customers${path.length > 1 ? `/${path.slice(1).map(encodeURIComponent).join("/")}` : ""}`,
    );
  if (path?.[0] === "opportunities") return <OpportunityWorkspace />;
  return <CrmWorkspace path={path ?? ["prospects"]} />;
}
