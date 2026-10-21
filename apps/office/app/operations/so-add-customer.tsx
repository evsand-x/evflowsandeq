"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";

export function AddOrderCustomer() {
  const { principal } = useSession();
  if (
    !principal ||
    !hasCompanyPermission(principal, "master_customer.create") ||
    !hasCompanyPermission(principal, "master_customer.read")
  )
    return null;
  return (
    <Button type="button" variant="outline" asChild>
      <Link href="/master-data/customers/new">
        <Plus aria-hidden="true" />
        Tambah Pelanggan
      </Link>
    </Button>
  );
}
