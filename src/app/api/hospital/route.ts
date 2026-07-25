import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireHospitalUser } from "@/lib/session";

/** Current user's hospital: name, invite code, members. */
export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const hospital = await prisma.hospital.findUnique({
    where: { id: guard.user.hospitalId },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(hospital);
}

/** Create a hospital workspace — the creator becomes ADMIN. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if ((user as { hospitalId?: string | null }).hospitalId) {
    return NextResponse.json(
      { error: "You already belong to a hospital" },
      { status: 409 },
    );
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Hospital name is required" }, { status: 400 });
  }

  const hospital = await prisma.hospital.create({
    data: { name: name.trim(), inviteCode: generateInviteCode() },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { hospitalId: hospital.id, role: "ADMIN" },
  });

  return NextResponse.json(hospital, { status: 201 });
}

function generateInviteCode(): string {
  // Unambiguous uppercase code like "K7TR-2MHX"
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}
