import { createServerFn } from "@tanstack/react-start";
import { resolveWhopIdentity } from "./whop.server";

export const testWhopAuthentication = createServerFn({
  method: "GET",
}).handler(async () => {
  const identity = await resolveWhopIdentity();

  if (!identity) {
    return {
      success: false,
      authenticated: false,
      message: "Aucun membre Whop authentifié ou accès refusé.",
    };
  }

  return {
    success: true,
    authenticated: true,
    user: {
      id: identity.id,
      name: identity.name,
      plan: identity.plan,
    },
    message: "Authentification Whop et accès Smart Point validés.",
  };
});