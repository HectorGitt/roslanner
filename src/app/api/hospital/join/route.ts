import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** Join an existing hospital with its invite code. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if ((user as { hospitalId?: string | null }).hospitalId) {
    return NextResponse.json(
      { error: "You already belong to a hospital" },
      { status: 409 },
    );
  }

  const { inviteCode } = await req.json();
  const code = String(inviteCode ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  const hospital = await prisma.hospital.findUnique({ where: { inviteCode: code } });
  if (!hospital) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { hospitalId: hospital.id, role: "MEMBER" },
  });

  return NextResponse.json({ id: hospital.id, name: hospital.name });
}
