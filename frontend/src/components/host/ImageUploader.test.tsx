import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stationsApi } from "@/lib/api/stations";
import { blobToDataUrl, prepareSquareImage } from "@/lib/host/image-processing";
import { ImageUploader } from "./ImageUploader";

vi.mock("@/lib/host/image-processing", () => ({
  prepareSquareImage: vi.fn(
    async () => new Blob(["image"], { type: "image/jpeg" }),
  ),
  blobToDataUrl: vi.fn(async () => "data:image/jpeg;base64,preview"),
}));

let uploadStatuses: number[] = [];

class MockXhr extends EventTarget {
  readonly upload = new EventTarget();
  status = 200;
  responseText = "";

  open() {}

  send() {
    this.status = uploadStatuses.shift() ?? 200;
    this.responseText =
      this.status >= 200 && this.status < 300
        ? JSON.stringify({
            secure_url:
              "https://res.cloudinary.com/demo/image/upload/candidate.jpg",
          })
        : JSON.stringify({ error: "upload failed" });
    queueMicrotask(() => this.dispatchEvent(new Event("load")));
  }
}

function renderUploader(onImageUrlChange = vi.fn()) {
  return render(
    <ImageUploader
      stationId="station-1"
      imageUrl={null}
      onImageUrlChange={onImageUrlChange}
      onDraftImageChange={vi.fn()}
      onUploadStateChange={vi.fn()}
      fileLabel="Choose candidate image"
      previewLabel="Square crop preview"
      removeLabel="Remove image"
      failureTitle="Image upload failed"
      failureDescription="The image could not be uploaded. Try again."
      fileTooLarge="This image file is too large. Choose a smaller image and try again."
      retryLabel="Retry Upload"
      closeLabel="Close"
      uploadingLabel="Uploading image"
      translateError={(key) => key}
    />,
  );
}

beforeEach(() => {
  uploadStatuses = [];
  vi.mocked(prepareSquareImage).mockResolvedValue(
    new Blob(["image"], { type: "image/jpeg" }),
  );
  vi.mocked(blobToDataUrl).mockResolvedValue("data:image/jpeg;base64,preview");
  vi.spyOn(stationsApi, "signUpload").mockResolvedValue({
    cloudName: "demo",
    apiKey: "test-key",
    timestamp: 100,
    signature: "signature",
    folder: "voting-app",
  });
  vi.stubGlobal("XMLHttpRequest", MockXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ImageUploader", () => {
  it("requests a signature and uploads the resized image to Cloudinary", async () => {
    const onImageUrlChange = vi.fn();
    renderUploader(onImageUrlChange);
    fireEvent.change(screen.getByLabelText("Choose candidate image"), {
      target: {
        files: [new File(["raw"], "candidate.png", { type: "image/png" })],
      },
    });

    await waitFor(() =>
      expect(onImageUrlChange).toHaveBeenCalledWith(
        "https://res.cloudinary.com/demo/image/upload/candidate.jpg",
      ),
    );
    expect(stationsApi.signUpload).toHaveBeenCalledWith("station-1");
  });

  it("shows an upload alert and retries after a Cloudinary failure", async () => {
    uploadStatuses = [500, 200];
    const onImageUrlChange = vi.fn();
    renderUploader(onImageUrlChange);
    fireEvent.change(screen.getByLabelText("Choose candidate image"), {
      target: {
        files: [new File(["raw"], "candidate.png", { type: "image/png" })],
      },
    });
    const alert = await screen.findByRole("dialog", {
      name: "Image upload failed",
    });
    expect(alert).toHaveTextContent(
      "The image could not be uploaded. Try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry Upload" }));

    await waitFor(() =>
      expect(onImageUrlChange).toHaveBeenCalledWith(
        "https://res.cloudinary.com/demo/image/upload/candidate.jpg",
      ),
    );
  });

  it("shows the file-too-large alert and opens the file picker to retry", async () => {
    vi.mocked(prepareSquareImage).mockRejectedValueOnce(
      new Error("station.image.tooLarge"),
    );
    renderUploader();
    fireEvent.change(screen.getByLabelText("Choose candidate image"), {
      target: {
        files: [new File(["raw"], "large.png", { type: "image/png" })],
      },
    });

    const alert = await screen.findByRole("dialog", {
      name: "Image upload failed",
    });
    expect(alert).toHaveTextContent(
      "This image file is too large. Choose a smaller image and try again.",
    );
    expect(stationsApi.signUpload).not.toHaveBeenCalled();
  });
});
