import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export interface HospitalUser {
  id: string;
  name: string;
  email: string;
  hospitalId: string;
  role: string;
}

/** Current signed-in user, or null. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/**
 * For API routes: require a signed-in user that belongs to a hospital.
 * Returns { user } on success, or { response } to return directly.
 */
export async function requireHospitalUser(): Promise<
  { user: HospitalUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  const hospitalId = (user as { hospitalId?: string | null }).hospitalId;
  if (!hospitalId) {
    return {
      response: NextResponse.json(
        { error: "No hospital workspace yet" },
        { status: 403 },
      ),
    };
  }
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      hospitalId,
      role: (user as { role?: string }).role ?? "MEMBER",
    },
  };
}
