/** Open one sibling at each level; closing a branch also closes its descendants. */
export function toggleSidebarBranch(
  groups: Record<string, boolean>,
  key: string,
  open: boolean,
): Record<string, boolean> {
  const parent = key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : "";
  const next = { ...groups };
  for (const candidate of Object.keys(next)) {
    const candidateParent = candidate.includes("/")
      ? candidate.slice(0, candidate.lastIndexOf("/"))
      : "";
    if (
      (open && candidateParent === parent && candidate !== key) ||
      (!open && candidate.startsWith(`${key}/`))
    ) {
      next[candidate] = false;
      for (const child of Object.keys(next)) {
        if (child.startsWith(`${candidate}/`)) next[child] = false;
      }
    }
  }
  next[key] = open;
  return next;
}
