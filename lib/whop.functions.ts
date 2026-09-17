import { createServerFn } from "@tanstack/react-start";

export type WhopIdentity = {
  id: string;
  name: string;
  plan: string;
};

/**
 * Resolves the authenticated Whop member on the server.
 *
 * The browser never supplies the member ID directly.
 * The server reads the Whop request context and verifies
 * access before returning the identity.
 */
export const getWhopIdentity = createServerFn({
  method: "GET",
}).handler(async (): Promise<WhopIdentity | null> => {
  const { resolveWhopIdentity } =
    await import("./whop.server");

  return resolveWhopIdentity();
});