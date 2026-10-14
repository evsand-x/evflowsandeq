"use client";

import { useParams } from "next/navigation";
import { AccessPage } from "../../../access-page";

export default function RolePermissionsPage() {
  const params = useParams<{ roleId: string }>();
  return <AccessPage section="matrix" roleId={params.roleId} />;
}
