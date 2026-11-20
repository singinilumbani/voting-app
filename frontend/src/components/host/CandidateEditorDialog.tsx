"use client";

import type { FormEvent } from "react";
import { M3Button, M3TextField } from "@/components/ui/primitives";
import { M3ModalDialog } from "@/components/ui/dialogs";
import { useT } from "@/lib/i18n";
import { ImageUploader } from "./ImageUploader";

export type CandidateEditorDialogProps = Readonly<{
  open: boolean;
  stationId: string;
  editing: boolean;
  name: string;
  imageUrl: string | null;
  draftImageDataUrl?: string;
  busy: boolean;
  uploading: boolean;
  error?: string;
  onNameChange: (name: string) => void;
  onImageUrlChange: (imageUrl: string | null) => void;
  onDraftImageChange: (dataUrl: string | undefined) => void;
  onUploadStateChange: (uploading: boolean) => void;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}>;

export function CandidateEditorDialog({
  open,
  stationId,
  editing,
  name,
  imageUrl,
  draftImageDataUrl,
  busy,
  uploading,
  error,
  onNameChange,
  onImageUrlChange,
  onDraftImageChange,
  onUploadStateChange,
  onClose,
  onSave,
}: CandidateEditorDialogProps) {
  const t = useT();

  return (
    <M3ModalDialog
      open={open}
      onClose={onClose}
      title={t(editing ? "station.editCandidate" : "station.addCandidate")}
    >
      <form className="station-candidate-form" onSubmit={onSave}>
        <M3TextField
          label={t("station.candidateName")}
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
          required
          error={
            error === t("station.validation.candidateName") ? error : undefined
          }
        />
        <ImageUploader
          stationId={stationId}
          imageUrl={imageUrl}
          draftImageDataUrl={draftImageDataUrl}
          onImageUrlChange={onImageUrlChange}
          onDraftImageChange={onDraftImageChange}
          onUploadStateChange={onUploadStateChange}
          fileLabel={t("station.imageFile")}
          previewLabel={t("station.imagePreview")}
          removeLabel={t("station.removeImage")}
          failureTitle={t("station.uploadFailureTitle")}
          failureDescription={t("station.uploadFailureDescription")}
          fileTooLarge={t("station.image.too_large")}
          retryLabel={t("station.retryUpload")}
          closeLabel={t("common.close")}
          uploadingLabel={t("station.uploading")}
          translateError={t}
        />
        {error && error !== t("station.validation.candidateName") && (
          <p role="alert">{error}</p>
        )}
        <div className="ui-dialog__actions">
          <M3Button type="button" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </M3Button>
          <M3Button
            type="submit"
            loading={busy}
            disabled={uploading || Boolean(draftImageDataUrl && !imageUrl)}
          >
            {t("common.save")}
          </M3Button>
        </div>
      </form>
    </M3ModalDialog>
  );
}
