import { redirect } from "next/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  redirect(view ? `/?view=${encodeURIComponent(view)}` : "/");
}
