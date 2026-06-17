import type { MatchContext } from "../../shared/schemas/live";

export const formatVenueLocation = (match: MatchContext["match"]): string =>
  [
    match.venue.stadium,
    match.venue.city,
    match.venue.state,
    match.venue.country
  ].join(", ");

export const formatRemainingSeconds = (remainingSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.round(remainingSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0 && seconds > 0) {
    return `${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
};
