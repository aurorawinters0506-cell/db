import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useWhopUser } from "@/components/app-shell";
import { PreviewDialog } from "@/components/preview-dialog";
import { TemplateCard } from "@/components/template-card";
import { SkeletonGrid } from "@/routes/index";
import {
  categoriesQuery,
  favoritesQuery,
  toggleFavorite,
  type Template,
} from "@/lib/catalog";

export const Route = createFileRoute("/favoris")({
  head: () => ({
    meta: [
      { title: "My Favorites — Smart Point" },
      {
        name: "description",
        content:
          "Find every PowerPoint template you saved to your Smart Point favorites.",
      },
      {
        property: "og:title",
        content: "My Favorites — Smart Point",
      },
      {
        property: "og:description",
        content:
          "Your saved PowerPoint templates, ready to download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const user = useWhopUser();
  const queryClient = useQueryClient();

  const [preview, setPreview] =
    useState<Template | null>(null);

  const favorites = useQuery(
    favoritesQuery(user.id),
  );

  /*
   * Gardé ici pour conserver le chargement des catégories
   * utilisé par les anciennes versions du composant et
   * maintenir la compatibilité avec le catalogue.
   */
  useQuery(categoriesQuery());

  async function handleToggleFavorite(
    template: Template,
  ) {
    try {
      await toggleFavorite(
        user.id,
        template.id ?? template.template_id,
        true,
      );

      await queryClient.invalidateQueries({
        queryKey: ["favorites", user.id],
      });

      toast.success("Removed from favorites");
    } catch (error) {
      console.error(
        "Erreur lors de la suppression du favori:",
        error,
      );

      toast.error(
        "Impossible de modifier les favoris.",
      );
    }
  }

  /*
   * Téléchargement sécurisé Smart Point.
   *
   * Le navigateur ne contacte jamais Google Drive directement.
   *
   * Le serveur /api/download :
   * 1. vérifie l'identité Whop
   * 2. vérifie l'accès au produit Smart Point
   * 3. récupère le fichier depuis Google Drive
   * 4. renvoie le fichier comme pièce jointe
   * 5. enregistre le téléchargement dans Supabase
   */
  async function handleDownload(
    template: Template,
    format: "pdf" | "pptx",
  ) {
    const templateId =
      template.id ??
      template.template_id;

    if (!templateId) {
      toast.error(
        "Unable to identify this template.",
      );

      return;
    }

    try {
      toast.loading(
        `Preparing ${format.toUpperCase()} download...`,
        {
          id: "smart-point-download",
        },
      );

      const response = await fetch(
        `/api/download?template_id=${encodeURIComponent(
          templateId,
        )}&file_type=${encodeURIComponent(
          format,
        )}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept:
              "application/octet-stream",
          },
        },
      );

      /*
       * Le serveur peut renvoyer une erreur JSON.
       * On essaie donc de récupérer son message
       * avant de lancer l'erreur.
       */
      if (!response.ok) {
        let message =
          "Unable to download this file.";

        try {
          const contentType =
            response.headers.get(
              "content-type",
            );

          if (
            contentType?.includes(
              "application/json",
            )
          ) {
            const data =
              await response.json();

            if (
              typeof data?.message ===
              "string"
            ) {
              message = data.message;
            } else if (
              typeof data?.error ===
              "string"
            ) {
              message = data.error;
            }
          } else {
            const text =
              await response.text();

            if (text.trim()) {
              message = text.trim();
            }
          }
        } catch {
          /*
           * On conserve le message par défaut
           * si la réponse d'erreur ne peut pas
           * être analysée.
           */
        }

        throw new Error(message);
      }

      /*
       * Transformation de la réponse serveur
       * en Blob pour déclencher le téléchargement
       * directement dans le navigateur.
       */
      const blob =
        await response.blob();

      if (blob.size === 0) {
        throw new Error(
          "The downloaded file is empty.",
        );
      }

      /*
       * Le serveur fournit le nom du fichier
       * dans Content-Disposition.
       */
      const contentDisposition =
        response.headers.get(
          "content-disposition",
        );

      let filename =
        `${templateId}.${format}`;

      const filenameMatch =
        contentDisposition?.match(
          /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i,
        );

      if (filenameMatch) {
        try {
          filename = decodeURIComponent(
            filenameMatch[1] ??
              filenameMatch[2] ??
              filename,
          );
        } catch {
          filename =
            filenameMatch[1] ??
            filenameMatch[2] ??
            filename;
        }
      }

      /*
       * Création d'une URL temporaire pour
       * déclencher le téléchargement.
       */
      const objectUrl =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      /*
       * Nettoyage de l'URL temporaire.
       */
      URL.revokeObjectURL(objectUrl);

      toast.success(
        `${format.toUpperCase()} downloaded successfully.`,
        {
          id: "smart-point-download",
        },
      );

      /*
       * Rafraîchit les données de la page
       * Téléchargements.
       */
      await queryClient.invalidateQueries({
        queryKey: [
          "downloads",
          user.id,
        ],
      });
    } catch (error) {
      console.error(
        "[Smart Point] secure download:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to download the file.",
        {
          id: "smart-point-download",
        },
      );
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-bold">
          Favorites
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {favorites.data?.length ?? 0} saved template(s).
        </p>
      </header>

      {favorites.isPending ? (
        <SkeletonGrid />
      ) : (favorites.data ?? []).length === 0 ? (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          No favorites yet. Select the heart on a template to
          save it here.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(favorites.data ?? []).map(
            ({ template }) => (
              <TemplateCard
                key={
                  template.id ??
                  template.template_id
                }
                template={template}
                isFavorite
                onPreview={setPreview}
                onToggleFavorite={
                  handleToggleFavorite
                }
                onDownload={handleDownload}
              />
            ),
          )}
        </div>
      )}

      <PreviewDialog
        template={preview}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
          }
        }}
        onDownload={handleDownload}
      />
    </div>
  );
}