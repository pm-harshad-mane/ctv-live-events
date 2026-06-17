import type { UpcomingEvent } from "../../shared/schemas/live";
import { formatVenueLocation } from "../lib/matchPresentation";

const formatProbability = (value: number): string =>
  `${Math.round(value * 100)}%`;

type UpcomingCardProps = {
  event: UpcomingEvent;
  isSelected: boolean;
  onSelect: (matchId: string) => void;
};

export const UpcomingCard = ({
  event,
  isSelected,
  onSelect
}: UpcomingCardProps) => {
  const participants = event.context.participants;
  const winProbabilities = event.upcoming_intelligence.win_probabilities
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
      className={`event-card event-card--upcoming ${isSelected ? "event-card--selected" : ""}`}
    >
      <div className="event-card__eyebrow">
        <span>{event.context.match.tournament_name}</span>
        <span>
          {new Date(event.context.match.scheduled_start_time).toLocaleString()}
        </span>
      </div>
      <h3>{event.context.match.match_name}</h3>
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
          <span>Competitiveness</span>
          <strong>{event.upcoming_intelligence.projected_competitiveness}</strong>
        </div>
        <div className="event-card__metric">
          <span>Start time</span>
          <strong>
            {new Date(event.context.match.scheduled_start_time).toLocaleTimeString(
              [],
              {
                hour: "numeric",
                minute: "2-digit"
              }
            )}
          </strong>
        </div>
      </div>
      <p className="event-card__upcoming-headline">
        {event.upcoming_intelligence.headline}
      </p>
      <p className="event-card__summary">{event.upcoming_intelligence.summary}</p>
      <ul className="event-card__points">
        {event.upcoming_intelligence.watch_reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <footer className="event-card__footer">
        <span>{formatVenueLocation(event.context.match)}</span>
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
