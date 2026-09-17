import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { useWhopUser } from "@/components/app-shell";
import { downloadsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/telechargements")({
  head: () => ({
    meta: [
      { title: "My Downloads — Smart Point" },
      {
        name: "description",
        content:
          "Your Smart Point PowerPoint and PDF template download history.",
      },
      {
        property: "og:title",
        content: "My Downloads — Smart Point",
      },
      {
        property: "og:description",
        content:
          "View every template you have downloaded.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const user = useWhopUser();

  const downloads = useQuery(
    downloadsQuery(user.id),
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-bold">
          Downloads
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {downloads.data?.length ?? 0} recorded download(s).
        </p>
      </header>

      {downloads.isPending ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Loading your downloads…
        </div>
      ) : (downloads.data ?? []).length === 0 ? (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          You have not downloaded anything yet.
        </p>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {(downloads.data ?? []).map((row) => {
            const template = row.template;

            const templateId =
              template.id ??
              template.template_id;

            const templateName =
              template.name ??
              template.title ??
              templateId;

            const templateCode =
              template.template_id ??
              template.code ??
              templateId;

            return (
              <li
                key={row.id}
                className="flex items-center gap-4 p-4"
              >
                <img
                  src={
                    template.preview_url ??
                    "/placeholder.svg"
                  }
                  alt={`Preview of ${templateName}`}
                  loading="lazy"
                  width={768}
                  height={512}
                  className="h-14 w-20 rounded-md object-cover"
                />

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {templateName}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {templateCode} ·{" "}
                    {new Date(
                      row.created_at,
                    ).toLocaleString("en-US")}
                  </p>
                </div>

                <span className="ml-auto flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium uppercase">
                  <Download className="h-3.5 w-3.5" />
                  {row.format}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}