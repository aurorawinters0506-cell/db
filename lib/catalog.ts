import { supabase } from "@/integrations/supabase/client";

/* =========================================================
   TYPES
   ========================================================= */

export type Category = {
  id: string;
  name: string;
  icon?: string;
  description?: string | null;
  color?: string | null;
};

export type Template = {
  template_id: string;
  name: string;
  category_id: string;
  category_name?: string | null;

  drive_pdf_id: string | null;
  drive_pptx_id: string | null;
  preview_file_id: string | null;

  preview_url: string | null;

  /*
   * IMPORTANT:
   * Les fichiers PDF/PPTX ne doivent plus être téléchargés
   * directement depuis Google Drive dans le navigateur.
   *
   * Ces champs sont conservés pour compatibilité avec l'UI.
   * Le vrai téléchargement sera effectué par le serveur.
   */
  pdf_url: string | null;
  pptx_url: string | null;

  is_active: boolean;

  created_at?: string | null;
  updated_at?: string | null;

  /* Compatibility with existing UI */
  id?: string;
  title?: string;
  code?: string;
  description?: string;
  slides?: number;
};

export type TemplatesQueryOptions = {
  categoryId?: string;
  search?: string;
  sort?: string;
};

/* =========================================================
   DOWNLOAD TYPES
   ========================================================= */

export type DownloadFormat = "pdf" | "pptx";

export type DownloadHistoryItem = {
  id: string;
  template_id: string;
  format: DownloadFormat;
  created_at: string;
  template?: Template;
};

/* =========================================================
   CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "";

const PREVIEW_BUCKET = "preview";

/* =========================================================
   CATEGORY TONES
   ========================================================= */

export const CATEGORY_TONES: Record<string, string> = {
  BC: "from-blue-500/20 to-blue-700/10",
  DA: "from-cyan-500/20 to-cyan-700/10",
  FR: "from-orange-500/20 to-orange-700/10",
  IF: "from-purple-500/20 to-purple-700/10",
  MH: "from-rose-500/20 to-rose-700/10",
  PS: "from-pink-500/20 to-pink-700/10",
  PP: "from-amber-500/20 to-amber-700/10",
  SI: "from-emerald-500/20 to-emerald-700/10",
  TI: "from-indigo-500/20 to-indigo-700/10",
  TT: "from-sky-500/20 to-sky-700/10",
};

/* =========================================================
   CATEGORY MAPPING
   ========================================================= */

export function mapCategory(row: any): Category {
  return {
    id: String(row?.id ?? ""),
    name: String(row?.name ?? ""),
    icon: row?.icon ?? undefined,
    description: row?.description ?? null,
    color: row?.color ?? null,
  };
}

/* =========================================================
   SUPABASE STORAGE PREVIEW
   ========================================================= */

/**
 * WEBP preview:
 *
 * Supabase Storage
 * bucket: preview
 *
 * Example:
 * https://PROJECT.supabase.co/storage/v1/object/public/preview/001SI.webp
 */
export function getSupabasePreviewUrl(
  templateId: string,
): string | null {
  if (!SUPABASE_URL || !templateId) {
    return null;
  }

  const cleanId = templateId
    .trim()
    .replace(/^\/+|\/+$/g, "");

  return `${SUPABASE_URL}/storage/v1/object/public/${PREVIEW_BUCKET}/${encodeURIComponent(
    cleanId,
  )}.webp`;
}

/* =========================================================
   GOOGLE DRIVE HELPERS
   ========================================================= */

/**
 * IMPORTANT:
 *
 * Ces fonctions ne doivent PAS être utilisées par le navigateur
 * pour effectuer le téléchargement final.
 *
 * Elles sont conservées uniquement pour compatibilité avec
 * d'anciennes parties éventuelles de l'application.
 */

export function getDrivePdfUrl(
  fileId?: string | null,
): string | null {
  if (!fileId) return null;

  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
    fileId,
  )}`;
}

export function getDrivePptxUrl(
  fileId?: string | null,
): string | null {
  if (!fileId) return null;

  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
    fileId,
  )}`;
}

/**
 * Compatibility helper for old parts of the app.
 *
 * Card previews now use Supabase Storage.
 */
export function getDrivePreviewUrl(
  fileId?: string | null,
): string | null {
  if (!fileId) return null;

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(
    fileId,
  )}&sz=w1600`;
}

/* =========================================================
   TEMPLATE MAPPING
   ========================================================= */

export function mapTemplate(
  row: any,
  categoryName?: string | null,
): Template {
  const templateId = String(
    row?.template_id ??
      row?.id ??
      "",
  );

  const name = String(
    row?.name ??
      row?.title ??
      templateId,
  );

  const categoryId = String(
    row?.category_id ?? "",
  );

  const drivePdfId =
    row?.drive_pdf_id ?? null;

  const drivePptxId =
    row?.drive_pptx_id ?? null;

  const previewFileId =
    row?.preview_file_id ?? null;

  return {
    template_id: templateId,

    name,

    category_id: categoryId,

    category_name:
      categoryName ??
      row?.category_name ??
      null,

    drive_pdf_id:
      drivePdfId,

    drive_pptx_id:
      drivePptxId,

    preview_file_id:
      previewFileId,

    /*
     * WEBP depuis Supabase Storage
     */
    preview_url:
      getSupabasePreviewUrl(
        templateId,
      ),

    /*
     * Ces deux valeurs ne doivent plus être
     * utilisées pour envoyer directement
     * l'utilisateur vers Google Drive.
     *
     * On les garde pour compatibilité avec
     * le composant Template.
     */
    pdf_url:
      drivePdfId
        ? getDrivePdfUrl(
            drivePdfId,
          )
        : null,

    pptx_url:
      drivePptxId
        ? getDrivePptxUrl(
            drivePptxId,
          )
        : null,

    is_active:
      row?.is_active !== false,

    created_at:
      row?.created_at ?? null,

    updated_at:
      row?.updated_at ?? null,

    /* Existing frontend compatibility */

    id:
      templateId,

    title:
      name,

    code:
      templateId,

    description:
      row?.description ?? "",

    slides:
      Number(
        row?.slides ?? 0,
      ),
  };
}

/* =========================================================
   CATEGORIES
   ========================================================= */

export function categoriesQuery() {
  return {
    queryKey: ["categories"],

    queryFn:
      async (): Promise<Category[]> => {
        const { data, error } =
          await supabase
            .from("categories")
            .select("*")
            .order("name", {
              ascending: true,
            });

        if (error) {
          console.error(
            "[Smart Point] categories:",
            error,
          );

          throw error;
        }

        return (
          data ?? []
        ).map(
          mapCategory,
        );
      },
  };
}

/* =========================================================
   CATEGORY COUNTS
   ========================================================= */

export function categoryCountsQuery() {
  return {
    queryKey: [
      "category-counts",
    ],

    queryFn:
      async (): Promise<
        Record<string, number>
      > => {
        const { data, error } =
          await supabase
            .from("templates")
            .select(
              "category_id",
            )
            .eq(
              "is_active",
              true,
            );

        if (error) {
          console.error(
            "[Smart Point] category counts:",
            error,
          );

          throw error;
        }

        const counts: Record<
          string,
          number
        > = {};

        for (
          const row of
            data ?? []
        ) {
          if (
            !row.category_id
          ) {
            continue;
          }

          counts[
            row.category_id
          ] =
            (
              counts[
                row.category_id
              ] ?? 0
            ) + 1;
        }

        return counts;
      },
  };
}

/* =========================================================
   TEMPLATES
   ========================================================= */

export function templatesQuery(
  options: TemplatesQueryOptions = {},
) {
  const {
    categoryId,
    search = "",
    sort = "newest",
  } = options;

  return {
    queryKey: [
      "templates",
      {
        categoryId,
        search,
        sort,
      },
    ],

    queryFn:
      async (): Promise<
        Template[]
      > => {
        let query =
          supabase
            .from(
              "templates",
            )
            .select(
              `
                *,
                categories (
                  name
                )
              `,
            )
            .eq(
              "is_active",
              true,
            );

        if (categoryId) {
          query =
            query.eq(
              "category_id",
              categoryId,
            );
        }

        const cleanSearch =
          search.trim();

        if (cleanSearch) {
          query =
            query.or(
              `name.ilike.%${cleanSearch}%,template_id.ilike.%${cleanSearch}%`,
            );
        }

        switch (sort) {
          case "oldest":
            query =
              query.order(
                "created_at",
                {
                  ascending:
                    true,
                },
              );
            break;

          case "name":
          case "az":
            query =
              query.order(
                "name",
                {
                  ascending:
                    true,
                },
              );
            break;

          case "za":
            query =
              query.order(
                "name",
                {
                  ascending:
                    false,
                },
              );
            break;

          case "newest":
          default:
            query =
              query.order(
                "created_at",
                {
                  ascending:
                    false,
                },
              );
            break;
        }

        const {
          data,
          error,
        } =
          await query.limit(
            1000,
          );

        if (error) {
          console.error(
            "[Smart Point] templates:",
            error,
          );

          throw error;
        }

        return (
          data ?? []
        ).map(
          (
            row: any,
          ) =>
            mapTemplate(
              row,
              row
                ?.categories
                ?.name ??
                null,
            ),
        );
      },
  };
}

/* =========================================================
   TEMPLATES BY CATEGORY
   ========================================================= */

export function templatesByCategoryQuery(
  categoryId: string,
) {
  return templatesQuery({
    categoryId,
  });
}

/* =========================================================
   SEARCH
   ========================================================= */

export function searchTemplatesQuery(
  search: string,
) {
  return templatesQuery({
    search,
  });
}

/* =========================================================
   FAVORITES
   ========================================================= */

export function favoritesQuery(
  whopUserId: string,
) {
  return {
    queryKey: [
      "favorites",
      whopUserId,
    ],

    queryFn:
      async (): Promise<
        Array<{
          template_id: string;
        }>
      > => {
        if (!whopUserId) {
          return [];
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "favorites",
            )
            .select(
              "template_id",
            )
            .eq(
              "whop_user_id",
              whopUserId,
            );

        if (error) {
          console.error(
            "[Smart Point] favorites:",
            error,
          );

          throw error;
        }

        return (
          data ?? []
        ).map(
          (
            row: any,
          ) => ({
            template_id:
              String(
                row.template_id,
              ),
          }),
        );
      },
  };
}

/* =========================================================
   CHECK FAVORITE
   ========================================================= */

export function isFavoriteQuery(
  whopUserId: string,
  templateId: string,
) {
  return {
    queryKey: [
      "favorite",
      whopUserId,
      templateId,
    ],

    queryFn:
      async (): Promise<boolean> => {
        if (
          !whopUserId ||
          !templateId
        ) {
          return false;
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "favorites",
            )
            .select(
              "template_id",
            )
            .eq(
              "whop_user_id",
              whopUserId,
            )
            .eq(
              "template_id",
              templateId,
            )
            .maybeSingle();

        if (error) {
          console.error(
            "[Smart Point] favorite check:",
            error,
          );

          throw error;
        }

        return Boolean(
          data,
        );
      },
  };
}

/* =========================================================
   TOGGLE FAVORITE
   ========================================================= */

export async function toggleFavorite(
  whopUserId: string,
  templateId: string,
  currentlyFavorite: boolean,
): Promise<void> {
  if (
    !whopUserId ||
    !templateId
  ) {
    throw new Error(
      "Whop user ID and template ID are required.",
    );
  }

  if (
    currentlyFavorite
  ) {
    const { error } =
      await supabase
        .from(
          "favorites",
        )
        .delete()
        .eq(
          "whop_user_id",
          whopUserId,
        )
        .eq(
          "template_id",
          templateId,
        );

    if (error) {
      console.error(
        "[Smart Point] delete favorite:",
        error,
      );

      throw error;
    }

    return;
  }

  const { error } =
    await supabase
      .from(
        "favorites",
      )
      .insert({
        whop_user_id:
          whopUserId,
        template_id:
          templateId,
      });

  if (error) {
    console.error(
      "[Smart Point] insert favorite:",
      error,
    );

    throw error;
  }
}

/* =========================================================
   DOWNLOAD HISTORY
   ========================================================= */

/**
 * IMPORTANT
 *
 * Nouvelle structure Supabase :
 *
 * downloads
 * ├── id
 * ├── template_id
 * ├── member_id
 * ├── file_type
 * └── downloaded_at
 *
 * Le code précédent utilisait :
 * ├── whop_user_id
 * ├── format
 * └── created_at
 *
 * Cette fonction utilise maintenant le nouveau schéma.
 *
 * NOTE :
 * Le serveur devra idéalement fournir l'historique
 * après vérification Whop.
 */
export function downloadsQuery(
  whopUserId: string,
) {
  return {
    queryKey: [
      "downloads",
      whopUserId,
    ],

    queryFn:
      async (): Promise<
        DownloadHistoryItem[]
      > => {
        if (!whopUserId) {
          return [];
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "downloads",
            )
            .select(
              `
                id,
                template_id,
                member_id,
                file_type,
                downloaded_at,
                templates (
                  *,
                  categories (
                    name
                  )
                )
              `,
            )
            .eq(
              "member_id",
              whopUserId,
            )
            .order(
              "downloaded_at",
              {
                ascending:
                  false,
              },
            );

        if (error) {
          console.error(
            "[Smart Point] downloads:",
            error,
          );

          throw error;
        }

        return (
          data ?? []
        ).map(
          (
            row: any,
          ) => ({
            id:
              String(
                row.id,
              ),

            template_id:
              String(
                row.template_id,
              ),

            format:
              row.file_type ===
              "pptx"
                ? "pptx"
                : "pdf",

            created_at:
              row.downloaded_at,

            template:
              row.templates
                ? mapTemplate(
                    row.templates,
                    row
                      .templates
                      ?.categories
                      ?.name ??
                      null,
                  )
                : undefined,
          }),
        );
      },
  };
}

/* =========================================================
   RECORD DOWNLOAD
   ========================================================= */

/**
 * Enregistre un téléchargement dans Supabase.
 *
 * ATTENTION :
 * Pour la version finale sécurisée, cette fonction ne devra
 * idéalement plus être appelée directement depuis le navigateur
 * avec un member_id fourni par le client.
 *
 * Le téléchargement final devra passer par le serveur qui :
 *
 * 1. récupère l'identité Whop ;
 * 2. vérifie l'abonnement ;
 * 3. vérifie le template ;
 * 4. récupère le fichier Google Drive ;
 * 5. enregistre le téléchargement ;
 * 6. retourne le fichier au navigateur.
 */
export async function recordDownload(
  whopUserId: string,
  templateId: string,
  format: DownloadFormat,
): Promise<void> {
  if (
    !whopUserId ||
    !templateId
  ) {
    throw new Error(
      "Whop user ID and template ID are required.",
    );
  }

  const fileType =
    format === "pptx"
      ? "pptx"
      : "pdf";

  const {
    error,
  } =
    await supabase
      .from(
        "downloads",
      )
      .insert({
        template_id:
          templateId,

        member_id:
          whopUserId,

        file_type:
          fileType,
      });

  if (error) {
    console.error(
      "[Smart Point] record download:",
      error,
    );

    throw error;
  }
}