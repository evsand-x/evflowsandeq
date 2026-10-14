import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = ["prospects"] } = await params;
  // Preview record IDs do not identify operational records.
  const resource = path[0] ?? "prospects";
  const base =
    resource === "customers" ? "/master-data/customers" : `/crm/${encodeURIComponent(resource)}`;
  redirect(path[1] === "new" ? `${base}/new` : base);
}
