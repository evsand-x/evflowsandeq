import { redirect } from "next/navigation";

/** Kebijakan Operasional became Kebijakan Umum; keep old bookmarks working. */
export default function PoliciesRedirect() {
  redirect("/setting/general");
}
