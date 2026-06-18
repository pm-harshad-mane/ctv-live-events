import type { LiveEvent, LiveState } from "../../shared/schemas/live";
import { useActiveCountdown } from "../hooks/useActiveCountdown";
import { formatVenueLocation } from "../lib/matchPresentation";
import { ScoreTrendChart } from "./ScoreTrendChart";

type TrackerHistoryPoint = {
  capturedAt: string;
  liveState: LiveState;
};

type LiveMatchTrackerProps = {
  event: LiveEvent;
  history: TrackerHistoryPoint[];
};

const formatProbability = (value: number): string =>
  `${Math.round(value * 100)}%`;

const formatTrackerTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });

const getParticipantName = (event: LiveEvent, participantId: string): string =>
  event.context?.participants.find(
    (participant) => participant.participant_id === participantId
  )?.name ?? participantId;

const buildSeries = (
  history: TrackerHistoryPoint[],
  getValue: (state: LiveState) => number | null
) =>
  history
    .map((point) => ({
      timestamp: point.capturedAt,
      value: getValue(point.liveState)
    }))
    .filter((point): point is { timestamp: string; value: number } =>
      typeof point.value === "number" && Number.isFinite(point.value)
    );

const formatSportSpecificLabel = (key: string): string =>
  key
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const formatSportSpecificValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value == null) {
    return "Unavailable";
  }

  return String(value);
};

const TRACKER_SCORE_HELP: Record<string, string> = {
  "Watchability":
    "An overall live score for how worth-watching the match is right now.",
  "Tension":
    "How tense or high-pressure the current live moment is.",
  "Scoring Imminence":
    "How likely a score-changing event feels soon.",
  "Swing Potential":
    "How likely the current match state is to swing materially soon.",
  "Clarity":
    "How clear and interpretable the current match state is for consumers.",
  "Evidence":
    "How strong the underlying evidence is for this live-state read.",
  "Stakes":
    "How much competitive consequence or broader importance this match carries.",
  "Star Power":
    "How much attention the match commands because of star participants or marquee teams.",
  "Upset":
    "How plausible and interesting a surprise result is at this point in time.",
  "Narrative":
    "How strong the story around this match is, including rivalry, comeback, or tournament context.",
  "Excitement":
    "An overall score for how dramatic or entertaining the live state is.",
  "Criticality":
    "How much the current moment matters to the likely final outcome.",
  "Competitive Balance":
    "How evenly matched the two sides currently are.",
  "Momentum":
    "Which side has built the stronger recent push.",
  "Prediction Confidence":
    "How confident the model is in the current live forecast and probability estimates.",
  "Comeback Probability":
    "The chance that the currently trailing side still manages to win.",
  "Upset Probability":
    "The chance that the underdog or lower-rated side ends with the better result.",
  "Draw Probability":
    "The chance that the match ends level if a draw is possible in this sport or stage."
};

export const LiveMatchTracker = ({
  event,
  history
}: LiveMatchTrackerProps) => {
  const lastUpdatedAt = history.at(-1)?.capturedAt ?? null;
  const compactScoreDisplay =
    event.live_state.score.participant_scores.length > 0
      ? event.live_state.score.participant_scores
          .map((participantScore) => participantScore.display_score)
          .join(" - ")
      : event.live_state.score.display;
  const activeTimeLeft = useActiveCountdown(
    event.live_state.clock.remaining_seconds
  );
  const watchability = event.live_state.watchability ?? {
    current_score: 50,
    tension_score: 50,
    scoring_imminence_score: 50,
    swing_potential_score: 50,
    state_clarity_score: 50,
    evidence_strength_score: 50
  };
  const crossPhaseScores = event.live_state.cross_phase_scores ?? {
    stakes_score: 50,
    star_power_score: 50,
    upset_potential_score: 50,
    narrative_strength_score: 50
  };

  const scoreSeries = [
    {
      title: "Watchability",
      latestValue: `${watchability.current_score}`,
      points: buildSeries(history, (state) => state.watchability.current_score),
      description: TRACKER_SCORE_HELP.Watchability
    },
    {
      title: "Tension",
      latestValue: `${watchability.tension_score}`,
      points: buildSeries(history, (state) => state.watchability.tension_score),
      description: TRACKER_SCORE_HELP.Tension
    },
    {
      title: "Scoring Imminence",
      latestValue: `${watchability.scoring_imminence_score}`,
      points: buildSeries(
        history,
        (state) => state.watchability.scoring_imminence_score
      ),
      description: TRACKER_SCORE_HELP["Scoring Imminence"]
    },
    {
      title: "Swing Potential",
      latestValue: `${watchability.swing_potential_score}`,
      points: buildSeries(
        history,
        (state) => state.watchability.swing_potential_score
      ),
      description: TRACKER_SCORE_HELP["Swing Potential"]
    },
    {
      title: "Clarity",
      latestValue: `${watchability.state_clarity_score}`,
      points: buildSeries(
        history,
        (state) => state.watchability.state_clarity_score
      ),
      description: TRACKER_SCORE_HELP.Clarity
    },
    {
      title: "Evidence",
      latestValue: `${watchability.evidence_strength_score}`,
      points: buildSeries(
        history,
        (state) => state.watchability.evidence_strength_score
      ),
      description: TRACKER_SCORE_HELP.Evidence
    },
    {
      title: "Stakes",
      latestValue: `${crossPhaseScores.stakes_score}`,
      points: buildSeries(history, (state) => state.cross_phase_scores.stakes_score),
      description: TRACKER_SCORE_HELP.Stakes
    },
    {
      title: "Star Power",
      latestValue: `${crossPhaseScores.star_power_score}`,
      points: buildSeries(
        history,
        (state) => state.cross_phase_scores.star_power_score
      ),
      description: TRACKER_SCORE_HELP["Star Power"]
    },
    {
      title: "Upset",
      latestValue: `${crossPhaseScores.upset_potential_score}`,
      points: buildSeries(
        history,
        (state) => state.cross_phase_scores.upset_potential_score
      ),
      description: TRACKER_SCORE_HELP.Upset
    },
    {
      title: "Narrative",
      latestValue: `${crossPhaseScores.narrative_strength_score}`,
      points: buildSeries(
        history,
        (state) => state.cross_phase_scores.narrative_strength_score
      ),
      description: TRACKER_SCORE_HELP.Narrative
    },
    {
      title: "Excitement",
      latestValue: `${event.live_state.excitement.aggregate_score}`,
      points: buildSeries(history, (state) => state.excitement.aggregate_score),
      description: TRACKER_SCORE_HELP.Excitement
    },
    {
      title: "Criticality",
      latestValue: `${event.live_state.criticality.score}`,
      points: buildSeries(history, (state) => state.criticality.score),
      description: TRACKER_SCORE_HELP.Criticality
    },
    {
      title: "Competitive Balance",
      latestValue: `${event.live_state.competitive_balance.score}`,
      points: buildSeries(history, (state) => state.competitive_balance.score),
      description: TRACKER_SCORE_HELP["Competitive Balance"]
    },
    {
      title: "Momentum",
      latestValue: `${event.live_state.momentum.score}`,
      points: buildSeries(history, (state) => state.momentum.score),
      description: TRACKER_SCORE_HELP.Momentum
    },
    {
      title: "Prediction Confidence",
      latestValue: formatProbability(
        event.live_state.live_predictions.prediction_confidence
      ),
      points: buildSeries(
        history,
        (state) => state.live_predictions.prediction_confidence * 100
      ),
      description: TRACKER_SCORE_HELP["Prediction Confidence"]
    },
    {
      title: "Comeback Probability",
      latestValue: formatProbability(
        event.live_state.live_predictions.comeback_probability
      ),
      points: buildSeries(
        history,
        (state) => state.live_predictions.comeback_probability * 100
      ),
      description: TRACKER_SCORE_HELP["Comeback Probability"]
    },
    {
      title: "Upset Probability",
      latestValue: formatProbability(
        event.live_state.live_predictions.upset_probability
      ),
      points: buildSeries(
        history,
        (state) => state.live_predictions.upset_probability * 100
      ),
      description: TRACKER_SCORE_HELP["Upset Probability"]
    },
    {
      title: "Draw Probability",
      latestValue: formatProbability(
        event.live_state.live_predictions.draw_probability
      ),
      points: buildSeries(
        history,
        (state) => state.live_predictions.draw_probability * 100
      ),
      description: TRACKER_SCORE_HELP["Draw Probability"]
    }
  ];

  const probabilitySeries = event.live_state.live_predictions.win_probabilities.map(
    (prediction) => ({
      title: `${getParticipantName(event, prediction.participant_id)} Win %`,
      latestValue: formatProbability(prediction.probability),
      points: buildSeries(history, (state) => {
        const next = state.live_predictions.win_probabilities.find(
          (item) => item.participant_id === prediction.participant_id
        );
        return next ? next.probability * 100 : null;
      }),
      description: `Current win probability trend for ${getParticipantName(
        event,
        prediction.participant_id
      )}.`
    })
  );

  return (
    <section className="tracker-view">
      <div className="tracker-hero detail-card">
        <div className="tracker-hero__top">
          <div>
            <p className="hero__kicker">Single Match Tracker</p>
            <h2>
              {(event.context?.match.match_name ?? event.match_id) +
                " · " +
                compactScoreDisplay}
            </h2>
            <p className="detail-modal__copy">
              {event.live_state.summary.headline}
            </p>
          </div>
          <div className="tracker-hero__timing">
            <strong>{event.live_state.clock.display}</strong>
            <span>{event.live_state.period.display}</span>
            <span>Time left: {activeTimeLeft}</span>
          </div>
        </div>
        <div className="tracker-hero__meta">
          <span>{event.context?.match.tournament_name ?? "Live match"}</span>
          <span>{event.context?.match.tournament_stage ?? "Live"}</span>
          <span>
            Verified {Math.round(event.live_state.verification.confidence * 100)}%
          </span>
          {event.context ? (
            <span>{formatVenueLocation(event.context.match)}</span>
          ) : null}
          {lastUpdatedAt ? <span>Last updated {formatTrackerTime(lastUpdatedAt)}</span> : null}
        </div>
        <div className="tracker-hero__summary">
          <p>{event.live_state.what_is_happening.summary}</p>
        </div>
      </div>

      <section className="tracker-section">
        <div className="section-header">
          <div>
            <p className="hero__kicker">Score Trends</p>
            <h2>Primary live metrics over time.</h2>
          </div>
        </div>
        <div className="trend-grid">
          {probabilitySeries.map((series) => (
            <ScoreTrendChart
              key={series.title}
              title={series.title}
              latestValue={series.latestValue}
              points={series.points}
              description={series.description}
            />
          ))}
          {scoreSeries.map((series) => (
            <ScoreTrendChart
              key={series.title}
              title={series.title}
              latestValue={series.latestValue}
              points={series.points}
              description={series.description}
            />
          ))}
        </div>
      </section>

      <div className="tracker-detail-grid">
        <section className="detail-card">
          <h3>Live pulse</h3>
          <div className="detail-stat-list">
            <p>
              <strong>Status:</strong> {event.live_state.match_status}
            </p>
            <p>
              <strong>Situation code:</strong>{" "}
              {event.live_state.what_is_happening.situation_code}
            </p>
            <p>
              <strong>Likely next:</strong>{" "}
              {event.live_state.live_predictions.likely_next_major_event}
            </p>
            <p>
              <strong>Expected remaining duration:</strong>{" "}
              {event.live_state.live_predictions.expected_remaining_duration_minutes}{" "}
              minutes
            </p>
          </div>
        </section>

        <section className="detail-card">
          <h3>Active players</h3>
          <ul className="event-card__points">
            {event.live_state.active_players.map((player) => (
              <li key={player.player_id}>
                <strong>{player.player_name}</strong>: {player.impact_summary}
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-card">
          <h3>Recent sequence</h3>
          <ul className="event-card__points">
            {event.live_state.recent_events.map((recentEvent) => (
              <li key={`${recentEvent.match_time}-${recentEvent.description}`}>
                {recentEvent.match_time}: {recentEvent.description}
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-card">
          <h3>Sport-specific state</h3>
          <div className="detail-sport-specific__grid">
            {Object.entries(event.live_state.sport_specific)
              .filter(([, value]) => value !== null && value !== undefined)
              .map(([key, value]) => (
                <div key={key} className="detail-sport-specific__item">
                  <span>{formatSportSpecificLabel(key)}</span>
                  <strong>{formatSportSpecificValue(value)}</strong>
                </div>
              ))}
          </div>
        </section>

        <section className="detail-card">
          <h3>What to watch</h3>
          <ul className="event-card__points">
            {event.live_state.summary.key_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
};
