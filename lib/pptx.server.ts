import JSZip from "jszip";

export async function countPptxSlides(
  buffer: Buffer
): Promise<number> {
  const zip = await JSZip.loadAsync(buffer);

  const slides = Object.keys(zip.files).filter(
    (fileName) => /^ppt\/slides\/slide\d+\.xml$/i.test(fileName)
  );

  return slides.length;
}