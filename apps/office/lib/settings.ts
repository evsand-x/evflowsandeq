"use client";

import type { CompanyPreferences } from "@evflow/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";

export const preferencesKey = ["settings", "preferences"] as const;

export async function fetchPreferences() {
  return (await apiRequest<{ data: CompanyPreferences }>("/settings/preferences")).data;
}

export function usePreferences() {
  return useQuery({ queryKey: preferencesKey, queryFn: fetchPreferences, staleTime: 5 * 60_000 });
}
