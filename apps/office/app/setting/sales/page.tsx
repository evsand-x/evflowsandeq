import { redirect } from "next/navigation";

// The sales settings page moved to Setting › Termin & Kredit (stage 2b).
export default function SalesSettingsRedirect() {
  redirect("/setting/terms");
}
