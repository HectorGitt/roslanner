import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // In dev the app runs on whatever port is free, so trust any localhost
  // origin rather than maintaining a port list. In production only the
  // configured app URL is trusted.
  trustedOrigins:
    process.env.NODE_ENV === "production"
      ? [process.env.BETTER_AUTH_URL ?? ""].filter(Boolean)
      : ["http://localhost:*", "http://127.0.0.1:*"],
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
