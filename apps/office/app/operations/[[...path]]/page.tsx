import { redirect } from "next/navigation";
import { ProformaWorkspace } from "../proforma";
import { OperationsWorkspace } from "../workspace";
import { SalesOrderWorkspace } from "../sales-order";
import { OutboundWorkspace } from "../outbound";
import { TaxWorkspace } from "../tax-workspace";
import { AccountsWorkspace } from "../accounts-workspace";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ stage?: string; view?: string }>;
}) {
  const path = (await params).path ?? ["orders"];
  const query = await searchParams;
  if (path[0] === "accounts") return <AccountsWorkspace key={path.join("/")} path={path} />;
  // Jurnal otomatis moved to Setting > Pemetaan Akun; old links land there.
  if (path[0] === "accounting") redirect("/setting/account-mapping");
  // The tax master moved to Setting > Pajak; old links land there.
  if (["tax-rules", "tax-withholding"].includes(path[0] ?? "")) redirect("/setting/tax");
  // The transaction controls page is gone: credit lives on the customer, tax in Setting, quality in Persediaan.
  if (path[0] === "controls") redirect("/setting");
  if (["tax-documents", "tax-input"].includes(path[0] ?? ""))
    return <TaxWorkspace key={path.join("/")} path={path} />;
  if (["pick-slips", "warehouse", "returns"].includes(path[0] ?? ""))
    return (
      <OutboundWorkspace
        key={`${path.join("/")}:${query.stage}:${query.view}`}
        path={path}
        stage={query.stage}
        form={query.view === "form"}
      />
    );
  if (path[0] === "proformas" && path[1] === "from-order" && path[2] && path[3])
    return <ProformaWorkspace key={path.join("/")} orderId={path[2]} batchId={path[3]} />;
  if (path[0] === "proformas") return <ProformaWorkspace key={path.join("/")} id={path[1]} />;
  if (path[0] === "orders") return <SalesOrderWorkspace key={path.join("/")} path={path} />;
  return (
    <OperationsWorkspace
      key={`${path.join("/")}:${query.stage ?? ""}`}
      path={path}
      {...(query.stage ? { stage: query.stage } : {})}
    />
  );
}
