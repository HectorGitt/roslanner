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

  // ---- Who can be put in charge of a shift -------------------------------
  // Seniors and core clinical staff lead; interns and support staff don't.
  const leadTiers = [tierByName["Senior Executive"].id, core.id];
  const cleared = await prisma.staff.updateMany({
    where: { ward: { hospitalId }, tierId: { notIn: leadTiers } },
    data: { canBeLead: false },
  });
  const leaders = await prisma.staff.updateMany({
    where: { ward: { hospitalId }, tierId: { in: leadTiers } },
    data: { canBeLead: true },
  });
  console.log(`Able to lead: ${leaders.count} senior/core staff (${cleared.count} others cannot)`);

  // ---- Rules that carry their own setting --------------------------------
  await prisma.wardRule.deleteMany({ where: { ward: { hospitalId } } });
  await prisma.wardRule.create({
    data: { wardId: general.id, type: "CHARGE_LEAD_REQUIRED", params: {} },
  });
  await prisma.wardRule.create({
    data: { wardId: general.id, type: "MAX_HOURS_PER_WEEK", params: { hours: 48 } },
  });
  if (ae) {
    // Call duty runs in blocks, so a stretch of nights earns the same time off.
    await prisma.wardRule.create({
      data: {
        wardId: ae.id,
        type: "BLOCK_PATTERN_ON_OFF",
        params: { blockDays: 7 },
        tierId: core.id,
      },
    });
  }
  console.log("Ward rules: General needs a lead per shift and caps 48h/week; A&E has a 7-night block pattern");

  // ---- Balance fairness over the last month ------------------------------
  // Not `where: { wardId }` — a ward can now hold one rule set per staff group
  // as well as its own, so wardId alone no longer identifies a row.
  await prisma.ruleSet.updateMany({
    where: { wardId: general.id, groupId: null },
    data: { fairnessWindowDays: 30, minRestHours: 8 },
  });
  console.log("General Ward: fairness balanced over a 30-day window");

  // ---- Staff groups: doctors, nurses and domestic staff rostered apart ----
  // Some hospitals can't put every body of staff on one roster, because the
  // rules don't match: doctors work day + overnight call, nurses run three
  // shifts, domestic staff come in on weekdays only. Groups let all three share
  // a ward while being rostered separately. A group that defines no shifts,
  // coverage or rules of its own just uses the ward's.
  const GROUPS = [
    { name: "Medical", sortOrder: 0, roles: ["Doctor"] },
    { name: "Nursing", sortOrder: 1, roles: ["Nurse"] },
    { name: "Domestic", sortOrder: 2, roles: ["Porter"] },
  ];
  const groupByName = {};
  for (const g of GROUPS) {
    const existing = await prisma.staffGroup.findFirst({
      where: { hospitalId, name: g.name },
    });
    groupByName[g.name] =
      existing ??
      (await prisma.staffGroup.create({
        data: { hospitalId, name: g.name, sortOrder: g.sortOrder },
      }));
    for (const roleName of g.roles) {
      const role = roleName === "Porter" ? porterRole : roleByName[roleName];
      if (role) {
        await prisma.role.update({
          where: { id: role.id },
          data: { groupId: groupByName[g.name].id },
        });
      }
    }
  }
  console.log(
    `Groups: ${GROUPS.map((g) => `${g.name} (${g.roles.join(", ")})`).join(", ")}`,
  );

  // The surgical ward shows the split in practice. Matched case-insensitively
  // because it was created by hand in the UI, so its capitalisation isn't fixed.
  const surgical = await prisma.ward.findFirst({
    where: { hospitalId, name: { equals: "Male surgical ward", mode: "insensitive" } },
  });
  if (surgical) {
    // It was created empty through the UI, so give it staff to roster.
    const surgicalStaff = [
      ["Dr. Ibrahim", roleByName["Doctor"]],
      ["Dr. Chukwu", roleByName["Doctor"]],
      ["Dr. Lawal", roleByName["Doctor"]],
      ["Dr. Adeleke", roleByName["Doctor"]],
      ["Nurse Bisi", roleByName["Nurse"]],
      ["Nurse Dorcas", roleByName["Nurse"]],
      ["Nurse Esther", roleByName["Nurse"]],
      ["Nurse Fatima", roleByName["Nurse"]],
      ["Nurse Gloria", roleByName["Nurse"]],
      ["Nurse Hauwa", roleByName["Nurse"]],
      ["Mr. Danjuma (Porter)", porterRole],
      ["Mr. Emeka (Porter)", porterRole],
    ];
    for (const [name, role] of surgicalStaff) {
      if (!role) continue;
      const already = await prisma.staff.findFirst({
        where: { wardId: surgical.id, name },
      });
      if (!already) {
        await prisma.staff.create({
          data: { name, roleId: role.id, wardId: surgical.id },
        });
      }
    }

    const medical = groupByName["Medical"].id;
    const nursing = groupByName["Nursing"].id;
    const domestic = groupByName["Domestic"].id;

    // Doctors: a day shift and an overnight call — the Category B pattern.
    await prisma.shiftDefinition.deleteMany({
      where: { wardId: surgical.id, groupId: medical },
    });
    await prisma.shiftDefinition.createMany({
      data: [
        {
          wardId: surgical.id,
          groupId: medical,
          code: "DAY",
          label: "Day",
          startMinutes: 8 * 60,
          endMinutes: 16 * 60,
          crossesMidnight: false,
          isNightLike: false,
          sortOrder: 0,
        },
        {
          wardId: surgical.id,
          groupId: medical,
          code: "CALL",
          label: "Call Duty",
          startMinutes: 16 * 60,
          endMinutes: 8 * 60,
          crossesMidnight: true,
          isNightLike: true,
          payrollTag: "CALL_ALLOWANCE",
          sortOrder: 1,
        },
      ],
    });

    // Domestic staff: a single weekday shift, no nights.
    await prisma.shiftDefinition.deleteMany({
      where: { wardId: surgical.id, groupId: domestic },
    });
    await prisma.shiftDefinition.create({
      data: {
        wardId: surgical.id,
        groupId: domestic,
        code: "CLEAN",
        label: "Cleaning",
        startMinutes: 7 * 60,
        endMinutes: 15 * 60,
        crossesMidnight: false,
        isNightLike: false,
        sortOrder: 0,
      },
    });
    // Nursing defines none, so it inherits the ward's Morning/Afternoon/Night.

    const scopes = [
      [
        medical,
        [
          { shift: "DAY", roleId: roleByName["Doctor"]?.id ?? null, required: 1 },
          { shift: "CALL", roleId: roleByName["Doctor"]?.id ?? null, required: 1 },
        ],
      ],
      [
        nursing,
        [
          { shift: "MORNING", roleId: roleByName["Nurse"]?.id ?? null, required: 2 },
          { shift: "AFTERNOON", roleId: roleByName["Nurse"]?.id ?? null, required: 1 },
          { shift: "NIGHT", roleId: roleByName["Nurse"]?.id ?? null, required: 1 },
        ],
      ],
      [
        domestic,
        // Weekdays only: nobody cleans at the weekend.
        [{ shift: "CLEAN", roleId: porterRole.id, required: 1, daysOfWeek: [1, 2, 3, 4, 5] }],
      ],
    ];
    for (const [groupId, items] of scopes) {
      await prisma.coverageRequirement.deleteMany({
        where: { wardId: surgical.id, groupId },
      });
      await prisma.coverageRequirement.createMany({
        data: items.map((i) => ({
          wardId: surgical.id,
          groupId,
          shift: i.shift,
          roleId: i.roleId,
          required: i.required,
          daysOfWeek: i.daysOfWeek ?? [],
        })),
      });
    }

    // Doctors carry tighter limits than the ward's.
    const medFields = {
      maxConsecutiveDays: 5,
      maxNightsPerWeek: 2,
      maxConsecutiveNights: 2,
      minDaysOffPerWeek: 2,
      // A call ends at 08:00 and a day starts at 08:00, so any rest requirement
      // above zero would make the pattern unsatisfiable.
      minRestHours: 0,
      fairnessWindowDays: 0,
    };
    const medRules = await prisma.ruleSet.findFirst({
      where: { wardId: surgical.id, groupId: medical },
    });
    if (medRules) {
      await prisma.ruleSet.update({ where: { id: medRules.id }, data: medFields });
    } else {
      await prisma.ruleSet.create({
        data: { wardId: surgical.id, groupId: medical, ...medFields },
      });
    }

    console.log(
      "Male Surgical Ward: Medical on Day/Call with tighter limits, Nursing on the " +
        "ward's three shifts, Domestic weekday-only — three separate rosters.",
    );
  }

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
