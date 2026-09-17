import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const SEEN_KEY = "smartpoint.notifications_seen_at";

export const NEW_TEMPLATE_THRESHOLD = 10;

export type CategoryAlert = {
  categoryId: string;
  count: number;
  latestAt: string;
};

/**
 * Returns the last moment when the member opened
 * the notifications panel.
 */
export function getSeenAt(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SEEN_KEY);
}

/**
 * Stores the current time as the last notification check.
 */
export function markNotificationsSeen(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const timestamp = new Date().toISOString();

  window.localStorage.setItem(
    SEEN_KEY,
    timestamp,
  );

  return timestamp;
}

/**
 * Finds categories that received at least
 * 10 active templates since the member's
 * last notification check.
 */
export const newTemplatesQuery = (
  seenAt: string | null,
) =>
  queryOptions({
    queryKey: ["new-templates", seenAt],

    queryFn: async (): Promise<
      CategoryAlert[]
    > => {
      let query = supabase
        .from("templates")
        .select(
          "category_id, created_at",
        )
        .eq("is_active", true)
        .order("created_at", {
          ascending: false,
        })
        .limit(1000);

      if (seenAt) {
        query = query.gt(
          "created_at",
          seenAt,
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const groups = new Map<
        string,
        CategoryAlert
      >();

      for (const row of data ?? []) {
        if (!row.category_id) {
          continue;
        }

        const current =
          groups.get(row.category_id);

        if (current) {
          current.count += 1;

          if (
            row.created_at &&
            row.created_at > current.latestAt
          ) {
            current.latestAt =
              row.created_at;
          }

          continue;
        }

        groups.set(row.category_id, {
          categoryId: row.category_id,
          count: 1,
          latestAt:
            row.created_at ??
            new Date(0).toISOString(),
        });
      }

      return [...groups.values()]
        .filter(
          (group) =>
            group.count >=
            NEW_TEMPLATE_THRESHOLD,
        )
        .sort(
          (a, b) =>
            b.count - a.count,
        );
    },

    staleTime: 60_000,
  });