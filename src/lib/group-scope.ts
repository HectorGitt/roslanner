import { prisma } from "@/lib/db";

/**
 * Resolve a client-supplied group id against the caller's hospital.
 *
 * Returns `{ groupId: null }` for absent/empty, meaning ward-level config, and
 * an error for anything that isn't a group of this hospital — so a group id from
 * another tenant can't be attached to our rows.
 */
export async function resolveGroupScope(
  raw: unknown,
  hospitalId: string,
): Promise<{ groupId: string | null } | { error: string }> {
  if (raw === undefined || raw === null || raw === "") return { groupId: null };
  if (typeof raw !== "string") return { error: "Invalid group" };
  const group = await prisma.staffGroup.findFirst({ where: { id: raw, hospitalId } });
  if (!group) return { error: "Invalid group" };
  return { groupId: group.id };
}

/**
 * Pick the rows that apply to a group: its own if it has any, otherwise the
 * ward's. Mirrors the resolution in src/lib/roster/load.ts — group config
 * replaces ward config rather than adding to it.
 */
export function scopedRows<T extends { groupId: string | null }>(
  rows: T[],
  groupId: string | null,
): T[] {
  if (groupId) {
    const own = rows.filter((r) => r.groupId === groupId);
    if (own.length > 0) return own;
  }
  return rows.filter((r) => r.groupId === null);
}
