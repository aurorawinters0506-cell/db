import { createFileRoute } from "@tanstack/react-router";

import { resolveWhopIdentity } from "@/lib/whop.server";

type FileType = "pdf" | "pptx";

type TemplateRow = {
  template_id: string;
  name: string | null;
  drive_pdf_id: string | null;
  drive_pptx_id: string | null;
  is_active: boolean;
};

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  "https://eejgfehjeqdwribhgfjm.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const GOOGLE_CLIENT_EMAIL =
  process.env.GOOGLE_CLIENT_EMAIL;

const GOOGLE_PRIVATE_KEY =
  process.env.GOOGLE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

/**
 * ============================================================
 * GOOGLE SERVICE ACCOUNT
 * ============================================================
 */

function base64UrlEncode(
  value: string,
) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createGoogleJwt() {
  if (
    !GOOGLE_CLIENT_EMAIL ||
    !GOOGLE_PRIVATE_KEY
  ) {
    throw new Error(
      "Google Drive server credentials are missing.",
    );
  }

  const now = Math.floor(
    Date.now() / 1000,
  );

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: GOOGLE_DRIVE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader =
    base64UrlEncode(
      JSON.stringify(header),
    );

  const encodedPayload =
    base64UrlEncode(
      JSON.stringify(payload),
    );

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const crypto =
    await import("node:crypto");

  const signature =
    crypto
      .createSign("RSA-SHA256")
      .update(unsignedToken)
      .sign(GOOGLE_PRIVATE_KEY);

  const encodedSignature =
    signature
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return `${unsignedToken}.${encodedSignature}`;
}

async function getGoogleAccessToken() {
  const assertion =
    await createGoogleJwt();

  const response = await fetch(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body:
        new URLSearchParams({
          grant_type:
            "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
    },
  );

  if (!response.ok) {
    const text =
      await response.text();

    console.error(
      "[Smart Point] Google token error:",
      text,
    );

    throw new Error(
      "Unable to authenticate with Google Drive.",
    );
  }

  const data =
    (await response.json()) as {
      access_token?: string;
    };

  if (!data.access_token) {
    throw new Error(
      "Google did not return an access token.",
    );
  }

  return data.access_token;
}

/**
 * ============================================================
 * SUPABASE
 * ============================================================
 */

async function getTemplate(
  templateId: string,
): Promise<TemplateRow | null> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  const url =
    `${SUPABASE_URL}/rest/v1/templates` +
    `?select=template_id,name,drive_pdf_id,drive_pptx_id,is_active` +
    `&template_id=eq.${encodeURIComponent(
      templateId,
    )}` +
    `&limit=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey:
        SUPABASE_SERVICE_ROLE_KEY,
      Authorization:
        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    const text =
      await response.text();

    console.error(
      "[Smart Point] Supabase template error:",
      text,
    );

    throw new Error(
      "Unable to retrieve the template.",
    );
  }

  const rows =
    (await response.json()) as TemplateRow[];

  return rows[0] ?? null;
}

async function recordDownload(
  templateId: string,
  memberId: string,
  fileType: FileType,
) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/downloads`,
    {
      method: "POST",
      headers: {
        apikey:
          SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type":
          "application/json",
        Prefer:
          "return=minimal",
      },
      body: JSON.stringify({
        template_id: templateId,
        member_id: memberId,
        file_type: fileType,
      }),
    },
  );

  if (!response.ok) {
    const text =
      await response.text();

    console.error(
      "[Smart Point] download history error:",
      text,
    );

    /*
     * History must never make an otherwise
     * successful file download fail.
     */
  }
}

/**
 * ============================================================
 * GOOGLE DRIVE DOWNLOAD
 * ============================================================
 */

async function downloadFromDrive(
  fileId: string,
) {
  const accessToken =
    await getGoogleAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?alt=media`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text =
      await response.text();

    console.error(
      "[Smart Point] Google Drive download error:",
      response.status,
      text,
    );

    if (response.status === 404) {
      throw new Error(
        "The requested file was not found on Google Drive.",
      );
    }

    if (
      response.status === 403
    ) {
      throw new Error(
        "Smart Point does not have permission to access this file.",
      );
    }

    throw new Error(
      "Unable to retrieve the file from Google Drive.",
    );
  }

  return response;
}

/**
 * ============================================================
 * FILENAME
 * ============================================================
 */

function buildFilename(
  template: TemplateRow,
  fileType: FileType,
) {
  const baseName =
    template.name?.trim() ||
    template.template_id;

  const safeName =
    baseName
      .replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "-",
      )
      .replace(/\s+/g, " ")
      .trim();

  return `${safeName}.${fileType}`;
}

/**
 * ============================================================
 * API ROUTE
 * ============================================================
 */

export const Route =
  createFileRoute("/api/download")({
    server: {
      handlers: {
        GET: async ({
          request,
        }) => {
          try {
            /*
             * ------------------------------------------------
             * 1. Validate request parameters
             * ------------------------------------------------
             */

            const url =
              new URL(request.url);

            const templateId =
              url.searchParams.get(
                "template_id",
              );

            const fileType =
              url.searchParams.get(
                "file_type",
              ) as FileType | null;

            if (!templateId) {
              return Response.json(
                {
                  error:
                    "Missing template_id.",
                },
                {
                  status: 400,
                },
              );
            }

            if (
              fileType !== "pdf" &&
              fileType !== "pptx"
            ) {
              return Response.json(
                {
                  error:
                    "file_type must be pdf or pptx.",
                },
                {
                  status: 400,
                },
              );
            }

            /*
             * ------------------------------------------------
             * 2. Validate Whop member
             * ------------------------------------------------
             *
             * IMPORTANT:
             * We NEVER trust member_id from the browser.
             *
             * resolveWhopIdentity() obtains the identity
             * from the Whop request token and verifies
             * access to the Smart Point product.
             */

            const identity =
              await resolveWhopIdentity();

            if (!identity) {
              return Response.json(
                {
                  error:
                    "You must have an active Smart Point membership to download files.",
                },
                {
                  status: 401,
                },
              );
            }

            /*
             * ------------------------------------------------
             * 3. Retrieve template from Supabase
             * ------------------------------------------------
             */

            const template =
              await getTemplate(
                templateId,
              );

            if (!template) {
              return Response.json(
                {
                  error:
                    "Template not found.",
                },
                {
                  status: 404,
                },
              );
            }

            if (
              template.is_active === false
            ) {
              return Response.json(
                {
                  error:
                    "This template is no longer available.",
                },
                {
                  status: 404,
                },
              );
            }

            /*
             * ------------------------------------------------
             * 4. Determine Google Drive file
             * ------------------------------------------------
             */

            const driveFileId =
              fileType === "pdf"
                ? template.drive_pdf_id
                : template.drive_pptx_id;

            if (!driveFileId) {
              return Response.json(
                {
                  error:
                    `The ${fileType.toUpperCase()} file has not been added yet.`,
                },
                {
                  status: 404,
                },
              );
            }

            /*
             * ------------------------------------------------
             * 5. Retrieve file from Google Drive
             * ------------------------------------------------
             */

            const driveResponse =
              await downloadFromDrive(
                driveFileId,
              );

            /*
             * ------------------------------------------------
             * 6. Prepare filename
             * ------------------------------------------------
             */

            const filename =
              buildFilename(
                template,
                fileType,
              );

            const contentType =
              fileType === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

            /*
             * ------------------------------------------------
             * 7. Record download
             * ------------------------------------------------
             */

            await recordDownload(
              template.template_id,
              identity.id,
              fileType,
            );

            /*
             * ------------------------------------------------
             * 8. Return file directly to browser
             * ------------------------------------------------
             *
             * Google Drive URL is NEVER exposed to the user.
             */

            const headers =
              new Headers();

            headers.set(
              "Content-Type",
              contentType,
            );

            headers.set(
              "Content-Disposition",
              `attachment; filename="${filename}"`,
            );

            headers.set(
              "Cache-Control",
              "private, no-store, max-age=0",
            );

            const contentLength =
              driveResponse.headers.get(
                "content-length",
              );

            if (contentLength) {
              headers.set(
                "Content-Length",
                contentLength,
              );
            }

            return new Response(
              driveResponse.body,
              {
                status: 200,
                headers,
              },
            );
          } catch (error) {
            console.error(
              "[Smart Point] /api/download:",
              error,
            );

            return Response.json(
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Unable to download the requested file.",
              },
              {
                status: 500,
              },
            );
          }
        },
      },
    },
  });