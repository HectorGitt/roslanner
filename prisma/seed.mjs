// Demo data: a hospital with an admin login, two wards, doctors + nurses,
// coverage, rules and some leave.
// Run with: node prisma/seed.mjs   (login: admin@demo.hospital / password123)
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

try {
  process.loadEnvFile();
} catch {
  // no .env — better-auth falls back to defaults for hashing (secret not needed)
}

const prisma = new PrismaClient();

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

const ADMIN_EMAIL = "admin@demo.hospital";
const ADMIN_PASSWORD = "password123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log("Seed data already present — skipping.");
    return;
  }

  // --- Hospital + admin user ---
  await auth.api.signUpEmail({
    body: { name: "Demo Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const hospital = await prisma.hospital.create({
    data: { name: "Demo Teaching Hospital", inviteCode: "DEMO-2026" },
  });
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { hospitalId: hospital.id, role: "ADMIN" },
  });

  // --- Roles ---
  const doctor = await prisma.role.create({
    data: { name: "Doctor", hospitalId: hospital.id },
  });
  const nurse = await prisma.role.create({
    data: { name: "Nurse", hospitalId: hospital.id },
  });

  // --- Wards ---
  const general = await prisma.ward.create({
    data: { name: "General Ward", hospitalId: hospital.id, rules: { create: {} } },
  });
  const icu = await prisma.ward.create({
    data: {
      name: "ICU",
      hospitalId: hospital.id,
      rules: { create: { maxNightsPerWeek: 2, maxConsecutiveNights: 3 } },
    },
  });

  const doctors = ["Dr. Adeyemi", "Dr. Okafor", "Dr. Bello", "Dr. Eze", "Dr. Musa"];
  const nurses = [
    "Nurse Amina",
    "Nurse Chidinma",
    "Nurse Funke",
    "Nurse Grace",
    "Nurse Halima",
    "Nurse Ifeoma",
    "Nurse Joy",
    "Nurse Kemi",
    "Nurse Ladi",
    "Nurse Ngozi",
  ];

  const generalStaff = [];
  for (const name of doctors) {
    generalStaff.push(
      await prisma.staff.create({
        data: { name, roleId: doctor.id, wardId: general.id },
      }),
    );
  }
  for (const name of nurses) {
    generalStaff.push(
      await prisma.staff.create({
        data: { name, roleId: nurse.id, wardId: general.id },
      }),
    );
  }

  for (const name of ["Dr. Sanni", "Dr. Umeh", "Dr. Yusuf"]) {
    await prisma.staff.create({ data: { name, roleId: doctor.id, wardId: icu.id } });
  }
  for (const name of ["Nurse Peace", "Nurse Rukayat", "Nurse Simi", "Nurse Tola", "Nurse Uche", "Nurse Zainab"]) {
    await prisma.staff.create({ data: { name, roleId: nurse.id, wardId: icu.id } });
  }

  // Coverage: General — 1 doctor + 3 nurses (M), 1 + 2 (A), 1 + 2 (N)
  await prisma.coverageRequirement.createMany({
    data: [
      { wardId: general.id, shift: "MORNING", roleId: doctor.id, required: 1 },
      { wardId: general.id, shift: "MORNING", roleId: nurse.id, required: 3 },
      { wardId: general.id, shift: "AFTERNOON", roleId: doctor.id, required: 1 },
      { wardId: general.id, shift: "AFTERNOON", roleId: nurse.id, required: 2 },
      { wardId: general.id, shift: "NIGHT", roleId: doctor.id, required: 1 },
      { wardId: general.id, shift: "NIGHT", roleId: nurse.id, required: 2 },
      { wardId: icu.id, shift: "MORNING", roleId: doctor.id, required: 1 },
      { wardId: icu.id, shift: "MORNING", roleId: nurse.id, required: 2 },
      { wardId: icu.id, shift: "AFTERNOON", roleId: doctor.id, required: 1 },
      { wardId: icu.id, shift: "AFTERNOON", roleId: nurse.id, required: 2 },
      { wardId: icu.id, shift: "NIGHT", roleId: doctor.id, required: 1 },
      { wardId: icu.id, shift: "NIGHT", roleId: nurse.id, required: 1 },
    ],
  });

  // Some leave next week
  const monday = nextMonday();
  await prisma.leaveRequest.create({
    data: {
      staffId: generalStaff[0].id, // Dr. Adeyemi
      startDate: addDays(monday, 2),
      endDate: addDays(monday, 4),
      type: "LEAVE",
      note: "Annual leave",
    },
  });
  await prisma.leaveRequest.create({
    data: {
      staffId: generalStaff[6].id, // a nurse
      startDate: addDays(monday, 5),
      endDate: addDays(monday, 5),
      type: "DAY_OFF_REQUEST",
      note: "Family event",
    },
  });

  console.log("Seeded: Demo Teaching Hospital (invite code DEMO-2026)");
  console.log(`Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

function nextMonday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}
function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

main().finally(() => prisma.$disconnect());
