// One-time normalisation: calendar-date columns are now stored as UTC midnight
// so a date means the same day regardless of the host's timezone. Rows written
// earlier used the writing machine's local midnight, which reads back a day
// early on a UTC host. Each value is rewritten to UTC midnight of the calendar
// day it was *intended* to represent (its local date on this machine).
//
// Safe to re-run: values already at UTC midnight are left alone.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const isUtcMidnight = (d) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

/** UTC midnight of the local calendar day this timestamp represents. */
const toUtcMidnight = (d) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

async function fixOne(label, rows, update) {
  let changed = 0;
  for (const row of rows) {
    const patch = update(row);
    if (patch) {
      changed++;
    }
  }
  console.log(`${label}: ${changed} of ${rows.length} rewritten`);
  return changed;
}

async function main() {
  const rosters = await prisma.roster.findMany();
  await fixOne("Roster.startDate", rosters, (r) => {
    if (isUtcMidnight(r.startDate)) return false;
    pending.push(
      prisma.roster.update({
        where: { id: r.id },
        data: { startDate: toUtcMidnight(r.startDate) },
      }),
    );
    return true;
  });

  const holidays = await prisma.publicHoliday.findMany();
  await fixOne("PublicHoliday.date", holidays, (h) => {
    if (isUtcMidnight(h.date)) return false;
    pending.push(
      prisma.publicHoliday.update({
        where: { id: h.id },
        data: { date: toUtcMidnight(h.date) },
      }),
    );
    return true;
  });

  const leave = await prisma.leaveRequest.findMany();
  await fixOne("LeaveRequest dates", leave, (l) => {
    const s = isUtcMidnight(l.startDate) ? l.startDate : toUtcMidnight(l.startDate);
    const e = isUtcMidnight(l.endDate) ? l.endDate : toUtcMidnight(l.endDate);
    if (s.getTime() === l.startDate.getTime() && e.getTime() === l.endDate.getTime()) return false;
    pending.push(
      prisma.leaveRequest.update({ where: { id: l.id }, data: { startDate: s, endDate: e } }),
    );
    return true;
  });

  const commitments = await prisma.staffDailyCommitment.findMany();
  await fixOne("StaffDailyCommitment.date", commitments, (c) => {
    if (isUtcMidnight(c.date)) return false;
    pending.push(
      prisma.staffDailyCommitment.update({
        where: { id: c.id },
        data: { date: toUtcMidnight(c.date) },
      }),
    );
    return true;
  });

  if (pending.length === 0) {
    console.log("Nothing to change.");
    return;
  }
  await prisma.$transaction(pending);
  console.log(`Applied ${pending.length} update(s).`);
}

const pending = [];
main().finally(() => prisma.$disconnect());
