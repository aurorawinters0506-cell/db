/**
 * Whop identity helper.
 *
 * Accounts, payments and membership live in Whop — the app never asks for a
 * sign-in. When embedded in Whop, the member is resolved server-side from the
 * signed Whop request token. Outside Whop (preview) we fall back to the iframe
 * URL parameters, then to a local preview member.
 */

const STORAGE_KEY = "smartpoint.whop_user";

export type WhopUser = {
  id: string;
  name: string;
  plan: string;
};

export const DEFAULT_USER: WhopUser = {
  id: "whop-preview-user",
  name: "Member",
  plan: "Premium Member",
};

export function getWhopUser(): WhopUser {
  if (typeof window === "undefined") return DEFAULT_USER;

  const params = new URLSearchParams(window.location.search);
  const id =
    params.get("whop_user_id") ??
    params.get("whopUserId") ??
    params.get("userId");
  const name = params.get("whop_username") ?? params.get("name");

  if (id) {
    const user: WhopUser = {
      id,
      name: name ?? "Member",
      plan: params.get("plan") ?? "Premium Member",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_USER, ...(JSON.parse(stored) as Partial<WhopUser>) };
    } catch {
      /* ignore malformed cache */
    }
  }
  return DEFAULT_USER;
}

export function cacheWhopUser(user: WhopUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}
