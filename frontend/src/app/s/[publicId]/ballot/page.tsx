"use client";

import { use } from "react";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { useDeviceId } from "@/lib/voter/use-device-id";
import { useFingerprint } from "@/lib/voter/use-fingerprint";
import { BallotExperience } from "@/components/voter/BallotExperience";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PublicPollBallotPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const station = usePublicStation();
  const { publicId } = use(params);
  const deviceId = useDeviceId(publicId);
  const fingerprint = useFingerprint();
  const router = useRouter();

  useEffect(() => {
    if (station?.mode === "CLOSED_VOTE") {
      router.replace(`/s/${encodeURIComponent(publicId)}/vote`);
    }
  }, [publicId, router, station]);

  if (station?.mode !== "PUBLIC_POLL") return null;
  const ballot = (station.categories ?? []).map((category) => ({
    id: category.id,
    title: category.title,
    candidates: (category.candidates ?? []).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      imageUrl: candidate.imageUrl ?? candidate.picture ?? null,
    })),
  }));

  return (
    <BallotExperience
      publicId={publicId}
      station={station}
      ballot={ballot}
      deviceId={deviceId}
      fingerprint={fingerprint}
    />
  );
}
