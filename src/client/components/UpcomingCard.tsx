import type { UpcomingEvent } from "../../shared/schemas/live";
import { useActiveCountdown } from "../hooks/useActiveCountdown";
import {
  formatVenueLocation,
  getUpcomingStartDetails
} from "../lib/matchPresentation";

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
  const audienceSignals = event.upcoming_intelligence.audience_signals ?? {
    audience_interest_score: 50,
    stakes_score: 50,
    star_power_score: 50,
    volatility_score: 50,
    upset_potential_score: 50,
    narrative_strength_score: 50
  };
  const crossPhaseScores = event.upcoming_intelligence.cross_phase_scores ?? {
    stakes_score: audienceSignals.stakes_score,
    star_power_score: audienceSignals.star_power_score,
    upset_potential_score: audienceSignals.upset_potential_score,
    narrative_strength_score: audienceSignals.narrative_strength_score
  };
  const startDetails = getUpcomingStartDetails(
    event.context.match.scheduled_start_time
  );
  const timeUntilStart = useActiveCountdown(startDetails.remainingSeconds);
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
  const scoreBlocks = [
    {
      label: "Audience interest",
      value: audienceSignals.audience_interest_score
    },
    {
      label: "Competitiveness",
      value: event.upcoming_intelligence.projected_competitiveness
    },
    {
      label: "Stakes",
      value: crossPhaseScores.stakes_score
    },
    {
      label: "Star power",
      value: crossPhaseScores.star_power_score
    },
    {
      label: "Volatility",
      value: audienceSignals.volatility_score
    },
    {
      label: "Upset",
      value: crossPhaseScores.upset_potential_score
    },
    {
      label: "Narrative",
      value: crossPhaseScores.narrative_strength_score
    }
  ];

  return (
    <article
      className={`event-card event-card--upcoming ${isSelected ? "event-card--selected" : ""}`}
    >
      <div className="event-card__eyebrow">
        <span>{event.context.match.tournament_name}</span>
        <span>{startDetails.startDisplay}</span>
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
      <div className="event-card__score-stack">
        <div className="event-card__score-grid event-card__score-grid--dense">
          {scoreBlocks.map((score) => (
            <div key={score.label} className="event-card__metric">
              <span>{score.label}</span>
              <strong>{score.value}</strong>
            </div>
          ))}
        </div>
        <div className="event-card__score-grid">
          <div className="event-card__metric">
            <span>Start status</span>
            <strong>{startDetails.isYetToStartToday ? "Yet to start" : "Scheduled"}</strong>
          </div>
          <div className="event-card__metric">
          <span>
            {startDetails.isYetToStartToday ? "Time left" : "Start time"}
          </span>
          <strong>
            {startDetails.isYetToStartToday
              ? timeUntilStart
              : new Date(
                  event.context.match.scheduled_start_time
                ).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit"
                })}
          </strong>
        </div>
        </div>
      </div>
      <p className="event-card__upcoming-headline">
        {event.upcoming_intelligence.headline}
      </p>
      <p className="event-card__summary">
        {event.upcoming_intelligence.summary}
      </p>
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
        {isSelected ? "Viewing details" : "More Details"}
      </button>
    </article>
  );
};
