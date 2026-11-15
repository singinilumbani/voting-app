"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { M3Button } from "@/components/ui/primitives";
import { M3ModalDialog } from "@/components/ui/dialogs";
import { stationsApi } from "@/lib/api/stations";
import { ApiError } from "@/lib/api/client";
import { blobToDataUrl, prepareSquareImage } from "@/lib/host/image-processing";

const cloudinaryResponseSchema = z.object({
  secure_url: z.string().url(),
});

export type ImageUploaderProps = Readonly<{
  stationId: string;
  imageUrl: string | null;
  draftImageDataUrl?: string;
  onImageUrlChange: (imageUrl: string | null) => void;
  onDraftImageChange: (dataUrl: string | undefined) => void;
  onUploadStateChange: (uploading: boolean) => void;
  fileLabel: string;
  previewLabel: string;
  removeLabel: string;
  failureTitle: string;
  failureDescription: string;
  fileTooLarge: string;
  retryLabel: string;
  closeLabel: string;
  uploadingLabel: string;
  translateError: (key: string) => string;
}>;

type CloudinarySignature = Awaited<ReturnType<typeof stationsApi.signUpload>>;

function uploadToCloudinary(
  signature: CloudinarySignature,
  blob: Blob,
  onProgress: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.timeout = 30_000;
    request.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,
    );
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("station.image.uploadFailed"));
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error("station.image.uploadFailed"));
        return;
      }
      const parsed = cloudinaryResponseSchema.safeParse(payload);
      if (!parsed.success) {
        reject(new Error("station.image.uploadFailed"));
        return;
      }
      resolve(parsed.data.secure_url);
    });
    request.addEventListener("error", () =>
      reject(new Error("station.image.uploadFailed")),
    );
    request.addEventListener("timeout", () =>
      reject(new Error("station.image.uploadFailed")),
    );

    const body = new FormData();
    body.append("file", blob, "candidate.jpg");
    body.append("api_key", signature.apiKey);
    body.append("timestamp", String(signature.timestamp));
    body.append("signature", signature.signature);
    body.append("folder", signature.folder);
    request.send(body);
  });
}

export function ImageUploader({
  stationId,
  imageUrl,
  draftImageDataUrl,
  onImageUrlChange,
  onDraftImageChange,
  onUploadStateChange,
  fileLabel,
  previewLabel,
  removeLabel,
  failureTitle,
  failureDescription,
  fileTooLarge,
  retryLabel,
  closeLabel,
  uploadingLabel,
  translateError,
}: ImageUploaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preparedBlob, setPreparedBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = draftImageDataUrl ?? imageUrl;

  async function upload(blob: Blob) {
    setBusy(true);
    onUploadStateChange(true);
    setFailure(null);
    setProgress(0);
    try {
      const signature = await stationsApi.signUpload(stationId);
      const uploadedImage = await uploadToCloudinary(
        signature,
        blob,
        setProgress,
      );
      onImageUrlChange(uploadedImage);
      onDraftImageChange(undefined);
      setPreparedBlob(null);
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.key
          : error instanceof Error && error.message === "station.image.tooLarge"
            ? "station.image.too_large"
            : "station.image.upload_failed",
      );
    } finally {
      setBusy(false);
      onUploadStateChange(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    setFailure(null);
    setPreparedBlob(null);
    onDraftImageChange(undefined);
    onUploadStateChange(true);
    try {
      const blob = await prepareSquareImage(file);
      const dataUrl = await blobToDataUrl(blob);
      setPreparedBlob(blob);
      onDraftImageChange(dataUrl);
      await upload(blob);
    } catch (error) {
      setFailure(
        error instanceof Error && error.message === "station.image.tooLarge"
          ? "station.image.too_large"
          : "station.image.processing_failed",
      );
    } finally {
      onUploadStateChange(false);
    }
  }

  async function retryUpload() {
    if (preparedBlob) {
      await upload(preparedBlob);
      return;
    }
    if (draftImageDataUrl) {
      onUploadStateChange(true);
      try {
        const blob = await fetch(draftImageDataUrl).then((response) =>
          response.blob(),
        );
        setPreparedBlob(blob);
        await upload(blob);
      } catch {
        setFailure("station.image.processing_failed");
      } finally {
        onUploadStateChange(false);
      }
      return;
    }
    fileInput.current?.click();
  }

  return (
    <div className="station-image-uploader">
      {preview && (
        <Image
          src={preview}
          alt={previewLabel}
          width={160}
          height={160}
          unoptimized
          className="station-image-preview"
        />
      )}
      <label className="station-image-uploader__file">
        <span>{fileLabel}</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(event) => void handleFileChange(event)}
          aria-label={fileLabel}
        />
      </label>
      {preview && (
        <M3Button
          type="button"
          variant="text"
          disabled={busy}
          onClick={() => {
            onImageUrlChange(null);
            onDraftImageChange(undefined);
            setPreparedBlob(null);
          }}
        >
          {removeLabel}
        </M3Button>
      )}
      {busy && (
        <p role="status">
          {uploadingLabel} {progress ?? 0}%
        </p>
      )}
      <M3ModalDialog
        open={failure !== null}
        onClose={() => setFailure(null)}
        title={failureTitle}
        actions={
          <>
            <M3Button variant="text" onClick={() => setFailure(null)}>
              {closeLabel}
            </M3Button>
            <M3Button onClick={() => void retryUpload()}>{retryLabel}</M3Button>
          </>
        }
      >
        <p role="alert">
          {failure === "station.image.too_large"
            ? fileTooLarge
            : failure === "station.image.processing_failed"
              ? failureDescription
              : failure && failure.startsWith("errors.")
                ? translateError(failure)
                : failureDescription}
        </p>
      </M3ModalDialog>
    </div>
  );
}
