import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  // Local dev runs on varying ports/hosts — trust them all so the
  // origin check doesn't reject sign-in when the port differs from
  // BETTER_AUTH_URL. Add your production URL here when deploying.
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      // Set server-side only (never from signup input)
      hospitalId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, defaultValue: "MEMBER", input: false },
    },
  },
  // NOTE: no session cookieCache — hospitalId changes during onboarding must be
  // visible immediately, and a cached cookie would serve stale user data.
});

export type AuthSession = typeof auth.$Infer.Session;
