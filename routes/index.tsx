  /*
   * Secure Smart Point download.
   *
   * The browser never opens Google Drive directly.
   * The server endpoint is responsible for:
   * 1. validating the Whop member
   * 2. validating product access
   * 3. retrieving the requested file
   * 4. returning it as an attachment
   * 5. recording the download
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
          // Keep default message.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      if (blob.size === 0) {
        throw new Error(
          "The downloaded file is empty.",
        );
      }

      /*
       * The server sends the filename through
       * Content-Disposition.
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
        filename = decodeURIComponent(
          filenameMatch[1] ??
            filenameMatch[2] ??
            filename,
        );
      }

      /*
       * Create a temporary browser URL,
       * trigger the download, then clean it.
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

      URL.revokeObjectURL(objectUrl);

      toast.success(
        `${format.toUpperCase()} downloaded successfully.`,
        {
          id: "smart-point-download",
        },
      );

      /*
       * Refresh the Téléchargements page.
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