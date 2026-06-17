import type { LiveEvent } from "../../shared/schemas/live";
import { useActiveCountdown } from "../hooks/useActiveCountdown";
import { formatVenueLocation } from "../lib/matchPresentation";

const VERIFICATION_HELP =
  "How strongly the backend trusts this live state based on source quality, corroboration, and live-data confidence.";

type EventCardProps = {
  event: LiveEvent;
  isSelected: boolean;
  isStale: boolean;
  onSelect: (matchId: string) => void;
};

export const EventCard = ({
  event,
  isSelected,
  isStale,
  onSelect
}: EventCardProps) => {
  const activeTimeLeft = useActiveCountdown(
    event.live_state.clock.remaining_seconds
  );

  return (
    <article
      className={`event-card ${isSelected ? "event-card--selected" : ""}`}
    >
      <div className="event-card__eyebrow">
        <span>{event.context?.match.tournament_name ?? "Live Match"}</span>
        <span>{isStale ? "Stale" : event.live_state.period.display}</span>
      </div>
      <h3>{event.context?.match.match_name ?? event.match_id}</h3>
      <div className="event-card__scoreline">
        <p className="event-card__score">{event.live_state.score.display}</p>
        <p className="event-card__clock">{event.live_state.clock.display}</p>
      </div>
      <p className="event-card__summary">Time left: {activeTimeLeft}</p>
      <p className="event-card__headline">
        {event.live_state.what_is_happening.headline}
      </p>
      <p className="event-card__summary">
        {event.live_state.summary.short_byte}
      </p>
      {event.context ? (
        <p className="event-card__summary">
          Location: {formatVenueLocation(event.context.match)}
        </p>
      ) : null}
      <ul className="event-card__points">
        {event.live_state.summary.key_points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <footer className="event-card__footer">
        <span>Excitement: {event.live_state.excitement.aggregate_score}</span>
        <span>{event.live_state.momentum.summary}</span>
        <span title={VERIFICATION_HELP} aria-label={`Verified. ${VERIFICATION_HELP}`}>
          Verified: {Math.round(event.live_state.verification.confidence * 100)}
          %
        </span>
      </footer>
      <button
        type="button"
        className="event-card__action"
        onClick={() => onSelect(event.match_id)}
      >
        {isSelected ? "Viewing details" : "Details"}
      </button>
    </article>
  );
};
