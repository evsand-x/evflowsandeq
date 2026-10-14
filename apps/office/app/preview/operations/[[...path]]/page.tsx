import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  redirect(
    path?.[0] === "orders" && path[1] === "new" ? "/operations/orders/new" : "/operations/orders",
  );
}
