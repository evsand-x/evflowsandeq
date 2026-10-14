import { ProformaWorkspace } from "../proforma";
import { OperationsWorkspace } from "../workspace";
import { SalesOrderWorkspace } from "../sales-order";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path ?? ["orders"];
  if (path[0] === "proformas" && path[1] === "from-order" && path[2] && path[3])
    return <ProformaWorkspace key={path.join("/")} orderId={path[2]} batchId={path[3]} />;
  if (path[0] === "proformas") return <ProformaWorkspace key={path.join("/")} id={path[1]} />;
  if (path[0] === "orders") return <SalesOrderWorkspace key={path.join("/")} path={path} />;
  return <OperationsWorkspace key={path.join("/")} path={path} />;
}
