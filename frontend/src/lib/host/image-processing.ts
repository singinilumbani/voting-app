import { STATION_LIMITS } from "@/lib/shared/station-constants";

export async function prepareSquareImage(file: File): Promise<Blob> {
  if (file.size > STATION_LIMITS.image.maximumFileBytes) {
    throw new Error("station.image.tooLarge");
  }

  const bitmap = await createImageBitmap(file);
  const cropSide = Math.min(bitmap.width, bitmap.height);
  const outputSide = Math.min(STATION_LIMITS.image.maximumSideLength, cropSide);
  const cropX = Math.floor((bitmap.width - cropSide) / 2);
  const cropY = Math.floor((bitmap.height - cropSide) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = outputSide;
  canvas.height = outputSide;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("station.image.processingFailed");
  }

  context.drawImage(
    bitmap,
    cropX,
    cropY,
    cropSide,
    cropSide,
    0,
    0,
    outputSide,
    outputSide,
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("station.image.processingFailed"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.85,
    );
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("station.image.processingFailed"));
    };
    reader.onerror = () => reject(new Error("station.image.processingFailed"));
    reader.readAsDataURL(blob);
  });
}
