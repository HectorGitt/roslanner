// Demo data for the scheduling features beyond the basics: staff tiers and
// their eligibility, a call-duty ward and an outpatient clinic, float staff,
// part-timers, public holidays, and a published month of history so
// rolling-window fairness has something to balance against.
//
// Writes to whatever DATABASE_URL points at. Idempotent: re-running converges
// on the same state rather than duplicating.
//
//   node prisma/seed-demo.mjs            keeps existing rosters
//   node prisma/seed-demo.mjs --reset-rosters   deletes them first
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  /* env may already be set */
}

const prisma = new PrismaClient();
const RESET_ROSTERS = process.argv.includes("--reset-rosters");

const h = (hours) => hours * 60;
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);
const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Tier definitions, and which shift codes each may work. */
const TIERS = [
  {
    name: "Senior Executive",
    rank: 1,
    countsTowardClinicalCoverage: true,
    maxConsecutiveNights: null,
    // Matrons/DDNS: days only, and off weekends and public holidays.
    eligible: ["MORNING", "DAY", "CLINIC_AM", "CLINIC_PM"],
    weekends: false,
    holidays: false,
  },
  {
    name: "Core Clinical",
    rank: 2,
    countsTowardClinicalCoverage: true,
    maxConsecutiveNights: null,
    eligible: "ALL",
    weekends: true,
    holidays: true,
  },
  {
    name: "Nurse Intern",
    rank: 3,
    countsTowardClinicalCoverage: true,
    maxConsecutiveNights: 2,
    // Standard three-shift model only — never overnight call duty.
    eligible: ["MORNING", "AFTERNOON", "NIGHT", "CLINIC_AM", "CLINIC_PM"],
    weekends: true,
    holidays: true,
  },
  {
    name: "Support Services",
    rank: 4,
    // Porters and ward attendants are rostered here but don't fill clinical cover.
    countsTowardClinicalCoverage: false,
    maxConsecutiveNights: null,
    eligible: "ALL",
    weekends: true,
    holidays: true,
  },
];

const HOLIDAYS = [
  [utc(2025, 12, 25), "Christmas Day", "CHRISTMAS_DAY"],
  [utc(2026, 10, 1), "Independence Day", "INDEPENDENCE_DAY"],
  [utc(2026, 12, 25), "Christmas Day", "CHRISTMAS_DAY"],
  [utc(2026, 12, 26), "Boxing Day", "BOXING_DAY"],
  [utc(2027, 1, 1), "New Year's Day", "NEW_YEARS_DAY"],
];

const CLINIC_SHIFTS = [
  { code: "CLINIC_AM", label: "Morning Clinic", startMinutes: h(8), endMinutes: h(12), isNightLike: false },
  { code: "CLINIC_PM", label: "Afternoon Clinic", startMinutes: h(13), endMinutes: h(17), isNightLike: false },
];

async function main() {
  const hospital = await prisma.hospital.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hospital) {
    console.error("No hospital found — run `npm run db:seed` first.");
    process.exitCode = 1;
    return;
  }
  const hospitalId = hospital.id;
  console.log(`Hospital: ${hospital.name}`);

  // ---- Tiers -------------------------------------------------------------
  const tierByName = {};
  for (const t of TIERS) {
    tierByName[t.name] = await prisma.staffTier.upsert({
      where: { hospitalId_name: { hospitalId, name: t.name } },
      create: {
        hospitalId,
        name: t.name,
        rank: t.rank,
        countsTowardClinicalCoverage: t.countsTowardClinicalCoverage,
        maxConsecutiveNights: t.maxConsecutiveNights,
      },
      update: {
        rank: t.rank,
        countsTowardClinicalCoverage: t.countsTowardClinicalCoverage,
        maxConsecutiveNights: t.maxConsecutiveNights,
      },
    });
  }
  console.log(`Tiers: ${TIERS.map((t) => t.name).join(", ")}`);

  const roles = await prisma.role.findMany({ where: { hospitalId } });
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));
  const porterRole =
    roleByName["Porter"] ??
    (await prisma.role.create({ data: { name: "Porter", hospitalId } }));

  // ---- Outpatient clinic ward (third shift model) -------------------------
  let gopd = await prisma.ward.findFirst({ where: { hospitalId, name: "GOPD Clinic" } });
  if (!gopd) {
    gopd = await prisma.ward.create({
      data: {
        hospitalId,
        name: "GOPD Clinic",
        category: "Outpatient Clinic",
        cycleLengthDays: 7,
        rules: { create: { maxNightsPerWeek: 0, maxConsecutiveNights: 0 } },
      },
    });
    await prisma.shiftDefinition.createMany({
      data: CLINIC_SHIFTS.map((s, i) => ({
        wardId: gopd.id,
        ...s,
        crossesMidnight: false,
        sortOrder: i,
      })),
    });
    for (const [name, role] of [
      ["Dr. Nwosu", roleByName["Doctor"]],
      ["Dr. Obi", roleByName["Doctor"]],
      ["Nurse Titi", roleByName["Nurse"]],
      ["Nurse Uche C.", roleByName["Nurse"]],
      ["Nurse Vera", roleByName["Nurse"]],
    ]) {
      await prisma.staff.create({
        data: {
          name,
          roleId: role.id,
          wardId: gopd.id,
          tierId: tierByName["Core Clinical"].id,
        },
      });
    }
    await prisma.coverageRequirement.createMany({
      data: [
        { wardId: gopd.id, shift: "CLINIC_AM", roleId: roleByName["Doctor"].id, required: 1 },
        { wardId: gopd.id, shift: "CLINIC_AM", roleId: roleByName["Nurse"].id, required: 2 },
        { wardId: gopd.id, shift: "CLINIC_PM", roleId: roleByName["Doctor"].id, required: 1 },
        { wardId: gopd.id, shift: "CLINIC_PM", roleId: roleByName["Nurse"].id, required: 1 },
      ],
    });
    console.log("Created GOPD Clinic (outpatient shift model, 7-day cycle)");
  }

  const wards = await prisma.ward.findMany({
    where: { hospitalId },
    include: { shiftDefinitions: true },
  });
  const wardByName = Object.fromEntries(wards.map((w) => [w.name, w]));
  const general = wardByName["General Ward"];
  const ae = wardByName["A&E Call Duty"];

  // ---- Enough staff to actually cover the requirements -------------------
  // A ward needs (slots per day x 7) at most (headcount x days each may work),
  // so thin wards produce rosters that are unsolvable rather than illustrative.
  // Top each one up to a comfortable headcount.
  const EXTRA_NAMES = {
    Doctor: ["Dr. Abiola", "Dr. Chukwu", "Dr. Danjuma", "Dr. Emeka", "Dr. Folake"],
    Nurse: ["Nurse Blessing", "Nurse Comfort", "Nurse Deborah", "Nurse Esther", "Nurse Favour"],
  };
  const TARGETS = {
    // Two of General's nurses are part-time, so it needs a little more headroom
    // than the raw slot count suggests.
    "General Ward": { Doctor: 6, Nurse: 12 },
    ICU: { Doctor: 5, Nurse: 7 },
    "A&E Call Duty": { Doctor: 4, Nurse: 6 },
    "GOPD Clinic": { Doctor: 4, Nurse: 6 },
  };
  for (const [wardName, targets] of Object.entries(TARGETS)) {
    const ward = wardByName[wardName];
    if (!ward) continue;
    for (const [roleName, target] of Object.entries(targets)) {
      const role = roleByName[roleName];
      if (!role) continue;
      const have = await prisma.staff.count({
        where: { wardId: ward.id, roleId: role.id, active: true },
      });
      for (let i = have; i < target; i++) {
        // Names are suffixed per ward so re-runs don't collide across wards.
        const base = EXTRA_NAMES[roleName][(i - have) % EXTRA_NAMES[roleName].length];
        const name = `${base} (${wardName.split(" ")[0]})`;
        const exists = await prisma.staff.findFirst({ where: { name, wardId: ward.id } });
        if (exists) continue;
        await prisma.staff.create({
          data: {
            name,
            roleId: role.id,
            wardId: ward.id,
            tierId: tierByName["Core Clinical"].id,
          },
        });
      }
      const now = await prisma.staff.count({
        where: { wardId: ward.id, roleId: role.id, active: true },
      });
      if (now > have) console.log(`${wardName}: ${roleName}s ${have} -> ${now}`);
    }
  }

  // ---- Tier eligibility, keyed by shift code across the hospital ----------
  const allCodes = [...new Set(wards.flatMap((w) => w.shiftDefinitions.map((s) => s.code)))];
  const eligibilityRows = [];
  for (const t of TIERS) {
    for (const code of allCodes) {
      const eligible = t.eligible === "ALL" || t.eligible.includes(code);
      eligibilityRows.push({
        tierId: tierByName[t.name].id,
        shiftCode: code,
        eligible,
        weekendEligible: t.weekends,
        holidayEligible: t.holidays,
      });
    }
  }
  await prisma.$transaction([
    prisma.tierShiftEligibility.deleteMany({ where: { tier: { hospitalId } } }),
    prisma.tierShiftEligibility.createMany({ data: eligibilityRows }),
  ]);
  console.log(`Eligibility: ${eligibilityRows.length} rows over shifts ${allCodes.join(", ")}`);

  // Interns must never be on shift without a core clinical colleague.
  const intern = tierByName["Nurse Intern"];
  const core = tierByName["Core Clinical"];
  if (
    !(await prisma.tierPairingRule.findFirst({
      where: { dependentTierId: intern.id, requiredTierId: core.id, shiftCode: null },
    }))
  ) {
    await prisma.tierPairingRule.create({
      data: { dependentTierId: intern.id, requiredTierId: core.id, minRequiredCount: 1 },
    });
  }
  console.log("Pairing: Nurse Intern always needs >=1 Core Clinical present");

  // ---- Give everyone a tier ----------------------------------------------
  const untiered = await prisma.staff.findMany({
    where: { tierId: null, ward: { hospitalId } },
    include: { role: true },
  });
  for (const s of untiered) {
    await prisma.staff.update({
      where: { id: s.id },
      data: { tierId: core.id },
    });
  }
  if (untiered.length) console.log(`Assigned Core Clinical to ${untiered.length} untiered staff`);

  // A senior in each of the two standard wards, so the morning-only rule is visible.
  for (const ward of [general, wardByName["ICU"]]) {
    if (!ward) continue;
    const seniorAlready = await prisma.staff.findFirst({
      where: { wardId: ward.id, tierId: tierByName["Senior Executive"].id },
    });
    if (!seniorAlready) {
      const candidate = await prisma.staff.findFirst({
        where: { wardId: ward.id, role: { name: "Doctor" } },
        orderBy: { name: "asc" },
      });
      if (candidate) {
        await prisma.staff.update({
          where: { id: candidate.id },
          data: { tierId: tierByName["Senior Executive"].id },
        });
        console.log(`${candidate.name} (${ward.name}) -> Senior Executive`);
      }
    }
  }

  // Interns in General Ward.
  const generalNurses = await prisma.staff.findMany({
    where: { wardId: general.id, role: { name: "Nurse" } },
    orderBy: { name: "asc" },
  });
  for (const s of generalNurses.slice(0, 3)) {
    await prisma.staff.update({ where: { id: s.id }, data: { tierId: intern.id } });
  }
  console.log(`Interns: ${generalNurses.slice(0, 3).map((s) => s.name).join(", ")}`);

  // ---- Support staff (non-clinical tier) ---------------------------------
  for (const name of ["Mr. Okon (Porter)", "Mr. Yakubu (Porter)"]) {
    const exists = await prisma.staff.findFirst({ where: { name, wardId: general.id } });
    if (!exists) {
      await prisma.staff.create({
        data: {
          name,
          roleId: porterRole.id,
          wardId: general.id,
          tierId: tierByName["Support Services"].id,
        },
      });
    }
  }
  console.log("Support Services: 2 porters in General Ward (excluded from clinical cover)");

  // ---- Part-timers -------------------------------------------------------
  const partTimers = generalNurses.slice(3, 5);
  for (const s of partTimers) {
    await prisma.staff.update({ where: { id: s.id }, data: { fte: 0.5 } });
  }
  console.log(`Part-time (0.5 FTE): ${partTimers.map((s) => s.name).join(", ")}`);

  // ---- Float pool --------------------------------------------------------
  if (ae) {
    const floaters = generalNurses.slice(5, 7);
    for (const s of floaters) {
      await prisma.staffWardEligibility.upsert({
        where: { staffId_wardId: { staffId: s.id, wardId: ae.id } },
        create: { staffId: s.id, wardId: ae.id },
        update: {},
      });
    }
    console.log(`Float pool: ${floaters.map((s) => s.name).join(", ")} can also work A&E`);
  }

  // ---- Seniority floor on General Ward -----------------------------------
  // Not an upsert: Prisma can't match a compound unique key when one of its
  // columns is null, which is exactly the shape of a tier-only requirement.
  for (const code of ["MORNING", "AFTERNOON", "NIGHT"]) {
    const existing = await prisma.coverageRequirement.findFirst({
      where: { wardId: general.id, shift: code, roleId: null, tierId: core.id },
    });
    if (existing) {
      await prisma.coverageRequirement.update({
        where: { id: existing.id },
        data: { required: 2 },
      });
    } else {
      await prisma.coverageRequirement.create({
        data: { wardId: general.id, shift: code, tierId: core.id, required: 2 },
      });
    }
  }
  console.log("Coverage: General Ward needs >=2 Core Clinical on every shift (any role)");

  // ---- Public holidays ---------------------------------------------------
  await prisma.publicHoliday.deleteMany({ where: { hospitalId } });
  await prisma.publicHoliday.createMany({
    data: HOLIDAYS.map(([date, name, groupKey]) => ({ hospitalId, date, name, groupKey })),
  });
  console.log(`Holidays: ${HOLIDAYS.map(([d, n]) => `${d.toISOString().slice(0, 10)} ${n}`).join(", ")}`);

  // ---- Balance fairness over the last month ------------------------------
  await prisma.ruleSet.update({
    where: { wardId: general.id },
    data: { fairnessWindowDays: 30, minRestHours: 8 },
  });
  console.log("General Ward: fairness balanced over a 30-day window");

  // ---- Rosters -----------------------------------------------------------
  if (RESET_ROSTERS) {
    const { count } = await prisma.roster.deleteMany({ where: { ward: { hospitalId } } });
    console.log(`Deleted ${count} existing roster(s)`);
  }

  console.log("");
  console.log("Config done. To give the fairness window some history to work with,");
  console.log("generate a roster for General Ward in the app and publish it — a");
  console.log("published roster is what the rolling window reads. Generating it with");
  console.log("the solver (rather than fabricating one here) keeps that history free of");
  console.log("rule violations, so it reads as a real month of work.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
