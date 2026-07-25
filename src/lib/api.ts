/**
 * Tiny client-side fetch helper — throws with the API's error message.
 * Redirects to /login when signed out and /onboarding when the user
 * has no hospital workspace yet.
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (typeof window !== "undefined") {
      if (res.status === 401 && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      } else if (
        res.status === 403 &&
        body.error === "No hospital workspace yet" &&
        !window.location.pathname.startsWith("/onboarding")
      ) {
        window.location.href = "/onboarding";
      }
    }
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}
