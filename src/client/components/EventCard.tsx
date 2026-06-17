import type { LiveEvent } from "../../shared/schemas/live";
import { useActiveCountdown } from "../hooks/useActiveCountdown";
import { formatVenueLocation } from "../lib/matchPresentation";

const VERIFICATION_HELP =
  "How strongly the backend trusts this live state based on source quality, corroboration, and live-data confidence.";
const formatProbability = (value: number): string =>
  `${Math.round(value * 100)}%`;

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
  const participants = event.context?.participants ?? [];
  const winProbabilities = event.live_state.live_predictions.win_probabilities
    .map((prediction) => ({
      ...prediction,
      name:
        participants.find(
          (participant) =>
            participant.participant_id === prediction.participant_id
        )?.name ?? prediction.participant_id
    }))
    .sort((left, right) => right.probability - left.probability);

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
      <div className="event-card__probability-band">
        {winProbabilities.map((prediction) => (
          <div
            key={prediction.participant_id}
            className="event-card__probability"
          >
            <span>{prediction.name}</span>
            <strong>{formatProbability(prediction.probability)}</strong>
          </div>
        ))}
      </div>
      <div className="event-card__metrics">
        <div className="event-card__metric">
          <span>Excitement</span>
          <strong>{event.live_state.excitement.aggregate_score}</strong>
        </div>
        <div className="event-card__metric">
          <span>Criticality</span>
          <strong>{event.live_state.criticality.score}</strong>
        </div>
      </div>
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
        <span>{event.live_state.momentum.summary}</span>
        <span
          title={VERIFICATION_HELP}
          aria-label={`Verified. ${VERIFICATION_HELP}`}
        >
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
