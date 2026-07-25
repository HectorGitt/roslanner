// One-time backfill: every existing ward gets its implicit Morning/Afternoon/Night
// shift definitions created explicitly, so nothing changes behaviorally until an
// admin configures a ward differently. Safe to re-run (skips wards that already
// have shift definitions).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_SHIFTS = [
  { code: "MORNING", label: "Morning", startMinutes: 8 * 60, endMinutes: 16 * 60, isNightLike: false, sortOrder: 0 },
  { code: "AFTERNOON", label: "Afternoon", startMinutes: 16 * 60, endMinutes: 22 * 60, isNightLike: false, sortOrder: 1 },
  {
    code: "NIGHT",
    label: "Night",
    startMinutes: 22 * 60,
    endMinutes: 8 * 60,
    crossesMidnight: true,
    isNightLike: true,
    sortOrder: 2,
  },
];

async function main() {
  const wards = await prisma.ward.findMany({ include: { shiftDefinitions: true } });
  let created = 0;
  for (const ward of wards) {
    if (ward.shiftDefinitions.length > 0) continue;
    await prisma.shiftDefinition.createMany({
      data: LEGACY_SHIFTS.map((s) => ({ ...s, wardId: ward.id })),
    });
    created += LEGACY_SHIFTS.length;
    console.log(`Backfilled ${ward.name}`);
  }
  console.log(created > 0 ? `Created ${created} shift definitions.` : "Nothing to backfill.");
}

main().finally(() => prisma.$disconnect());
