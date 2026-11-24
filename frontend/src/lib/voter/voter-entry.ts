export type VoterEntryStation = Readonly<{
  publicId: string;
  mode: "PUBLIC_POLL" | "CLOSED_VOTE";
  status: string;
}>;

export function getVoterEntryRoute(
  station: VoterEntryStation,
): "/register" | "/ballot" | null {
  const status = station.status.toUpperCase();
  if (station.mode === "CLOSED_VOTE") {
    if (status === "REG_OPEN" || status === "REGISTRATION_OPEN") {
      return "/register";
    }
    if (status === "VOTE_OPEN" || status === "VOTING_OPEN") {
      return "/ballot";
    }
  } else if (status === "VOTE_OPEN" || status === "VOTING_OPEN") {
    return "/ballot";
  }
  return null;
}

