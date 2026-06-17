import type {
  LiveState,
  MatchContext,
  UpcomingEvent
} from "../../shared/schemas/live";
import { type ReactNode, useEffect } from "react";
import { useActiveCountdown } from "../hooks/useActiveCountdown";
import { formatVenueLocation } from "../lib/matchPresentation";

const formatProbability = (value: number): string =>
  `${Math.round(value * 100)}%`;

const formatSignedProbabilityChange = (value: number): string =>
  `${value >= 0 ? "+" : ""}${Math.round(value * 100)} pts`;

const formatParticipantName = (
  context: MatchContext,
  participantId: string | null | undefined
): string => {
  if (!participantId) {
    return "Unknown";
  }

  return (
    context.participants.find(
      (participant) => participant.participant_id === participantId
    )?.name ?? participantId
  );
};

const humanizeKey = (value: string): string =>
  value
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const ATTRIBUTE_HELP: Record<string, string> = {
  Status: "The current lifecycle state of the match, such as live, paused, completed, or delayed.",
  "Situation code":
    "A compact machine-readable tag that describes the live game state at this moment.",
  "Key entities":
    "The participants or IDs most directly involved in the current live situation.",
  Momentum:
    "A short plain-language summary of which side is currently dictating the game and why.",
  "Last event":
    "The most important recent event that materially changed the live state or match story.",
  "Likely next":
    "The model's best estimate of the next major event that may occur if current conditions continue.",
  "Period code":
    "The normalized internal code for the current half, quarter, set, inning, or other phase of play.",
  "Elapsed seconds":
    "How many seconds have elapsed in the current live phase or official match clock context.",
  "Remaining seconds":
    "How many seconds are estimated to remain in the current phase or active clock window.",
  "Score differential":
    "The current margin between the two sides based on the live score.",
  "Current control":
    "Which side has possession, territorial control, or the clearest tactical initiative right now.",
  Venue:
    "The stadium or arena location where the match is being played.",
  "Key matchup":
    "The most important tactical or talent battle expected to shape this match.",
  Participants:
    "The teams or players taking part in the match.",
  Excitement:
    "An overall score for how dramatic or entertaining the live state is right now.",
  "Current excitement":
    "A point-in-time excitement reading based on the immediate game situation.",
  "Recent excitement":
    "An excitement reading based on the last stretch of play rather than only the current moment.",
  "Expected remaining excitement":
    "An estimate of how much drama is still likely before the match ends.",
  Criticality:
    "A score for how much the current moment matters to the likely outcome of the match.",
  "Competitive balance":
    "A score for how evenly matched the contest currently is.",
  "Momentum score":
    "A directional score showing which side has built the stronger recent push.",
  "Comeback probability":
    "The chance that the currently trailing side still manages to win.",
  "Upset probability":
    "The chance that the underdog or lower-rated side finishes with the better result.",
  "Draw probability":
    "The chance that the match ends level if a draw is possible in this sport or stage.",
  "Overtime or tiebreak probability":
    "The chance that extra time, overtime, or a tiebreak sequence will be needed.",
  "Expected remaining duration":
    "The estimated number of minutes left before the match reaches a final result.",
  "Prediction confidence":
    "How confident the model is in the current live forecast and probability estimates.",
  "Projected competitiveness":
    "A pre-match score estimating how close and compelling this matchup is expected to be.",
  "Context competitiveness":
    "The baseline competitiveness estimate inferred from slower-moving pre-match context.",
  "Win probabilities":
    "The pre-match chances for each side to win based on the current upcoming-match outlook.",
  "Last event id":
    "The internal identifier attached to the latest major recorded event.",
  "Last event type":
    "The normalized event category for the latest major play or incident.",
  "Last event participant":
    "The side most directly responsible for the latest major event.",
  "Last event player id":
    "The player identifier tied to the latest major event when known.",
  "Last event importance":
    "A score describing how strongly the latest event affected the state of the match.",
  "Verification status":
    "Whether the live state is fully verified, partially inferred, or otherwise uncertain.",
  "Generated at":
    "When this live-state snapshot was produced by the backend.",
  "Source observation time":
    "The timestamp of the source data observation used to build this state, if available."
};

const SPORT_SPECIFIC_HELP: Record<string, string> = {
  quarter: "The current quarter of play for basketball or other quarter-based sports.",
  phase:
    "A sport-specific phase label for the current state of play, such as open second half or power play.",
  stoppage_time_minutes:
    "The number of stoppage or added-time minutes currently expected or being played.",
  pressure_side:
    "The side currently applying sustained territorial or scoring pressure.",
  possession_team:
    "The team currently in possession of the ball or otherwise controlling play.",
  attacking_side:
    "The side currently moving forward in the more dangerous attacking phase.",
  down_and_distance:
    "The current football down and yards-to-go situation.",
  runners_on_base:
    "Which bases are currently occupied in baseball or softball.",
  set_score:
    "The current set-by-set score context for sports like tennis or volleyball.",
  serve_side:
    "The player or side currently serving."
};

const getAttributeHelp = (
  label: string,
  fallback = "This field describes one part of the live match state."
): string => ATTRIBUTE_HELP[label] ?? fallback;

const getSportSpecificHelp = (key: string): string =>
  SPORT_SPECIFIC_HELP[key] ??
  "A sport-specific live-state field that only applies to this sport's match flow.";

const VERIFICATION_HELP =
  "How strongly the backend trusts this match state based on source quality, corroboration, and live-data confidence. Higher percentages mean the current state is better verified.";

const TooltipLabel = ({
  label,
  description
}: {
  label: string;
  description: string;
}) => (
  <span
    className="detail-tooltip-label"
    data-tooltip={description}
    aria-label={`${label}. ${description}`}
    tabIndex={0}
  >
    {label}
  </span>
);

const DetailField = ({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) => (
  <p>
    <strong>
      <TooltipLabel
        label={label}
        description={description ?? getAttributeHelp(label)}
      />
      :
    </strong>{" "}
    {children}
  </p>
);

const formatSportSpecificValue = (
  key: string,
  value: unknown,
  participantName: (participantId: string | null | undefined) => string
): string => {
  if (value == null) {
    return "Unavailable";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return `${value}`;
  }

  if (typeof value === "string") {
    const shouldResolveParticipant =
      /(participant|team|side|control)/i.test(key) &&
      !/(phase|state|status)/i.test(key);

    if (shouldResolveParticipant) {
      const resolvedName = participantName(value);
      if (resolvedName !== value) {
        return resolvedName;
      }
    }

    return humanizeKey(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatSportSpecificValue(key, item, participantName))
      .join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([nestedKey, nestedValue]) =>
          `${humanizeKey(nestedKey)}: ${formatSportSpecificValue(
            nestedKey,
            nestedValue,
            participantName
          )}`
      )
      .join(" | ");
  }

  return String(value);
};

type DetailPanelProps = {
  liveMatchDetail?: {
    matchId: string;
    context: MatchContext;
    liveState: LiveState;
  } | null;
  upcomingEvent?: UpcomingEvent | null;
  status: "idle" | "loading" | "ready" | "error";
  errorMessage: string | null;
  onClear: () => void;
};

export const DetailPanel = ({
  liveMatchDetail,
  upcomingEvent,
  status,
  errorMessage,
  onClear
}: DetailPanelProps) => {
  const activeTimeLeft = useActiveCountdown(
    liveMatchDetail?.liveState.clock.remaining_seconds ?? 0
  );

  useEffect(() => {
    if (status === "idle" && !liveMatchDetail && !upcomingEvent) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClear();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [liveMatchDetail, onClear, status, upcomingEvent]);

  if (!liveMatchDetail && !upcomingEvent && status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <div className="detail-overlay" onClick={onClear}>
        <section
          className="detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-panel-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="detail-modal__header">
            <div>
              <p className="hero__kicker">Match Details</p>
              <h2
                id="detail-panel-title"
                className="detail-modal__title--loading"
              >
                Loading selected match details...
              </h2>
            </div>
            <button
              type="button"
              className="detail-panel__close"
              onClick={onClear}
            >
              Close
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="detail-overlay" onClick={onClear}>
        <section
          className="detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-panel-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="detail-modal__header">
            <div>
              <p className="hero__kicker">Match Details</p>
              <h2
                id="detail-panel-title"
                className="detail-modal__title--loading"
              >
                Unable to load selected match details.
              </h2>
            </div>
            <button
              type="button"
              className="detail-panel__close"
              onClick={onClear}
            >
              Close
            </button>
          </div>
          <p className="detail-modal__copy">{errorMessage}</p>
        </section>
      </div>
    );
  }

  if (liveMatchDetail) {
    const participantName = (
      participantId: string | null | undefined
    ): string => formatParticipantName(liveMatchDetail.context, participantId);
    const activeFlags = Object.entries(liveMatchDetail.liveState.special_state)
      .filter(([, enabled]) => enabled)
      .map(([key]) => humanizeKey(key.replace(/^is_/, "")));
    const uniqueReasonCodes = Array.from(
      new Set([
        ...liveMatchDetail.liveState.excitement.reason_codes,
        ...liveMatchDetail.liveState.criticality.reason_codes,
        ...liveMatchDetail.liveState.momentum.reason_codes
      ])
    );

    return (
      <div className="detail-overlay" onClick={onClear}>
        <section
          className="detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-panel-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="detail-modal__header">
            <div>
              <p className="hero__kicker">Selected Live Match</p>
              <h2 id="detail-panel-title">
                {liveMatchDetail.context.match.match_name}
              </h2>
            </div>
            <button
              type="button"
              className="detail-panel__close"
              onClick={onClear}
            >
              Close
            </button>
          </div>

          <div className="detail-hero">
            <div className="detail-hero__meta">
              <span>{liveMatchDetail.context.match.tournament_name}</span>
              <span>{liveMatchDetail.context.match.tournament_stage}</span>
              <span
                className="detail-tooltip-label"
                data-tooltip={VERIFICATION_HELP}
                aria-label={`Verified. ${VERIFICATION_HELP}`}
                tabIndex={0}
              >
                Verified{" "}
                {Math.round(
                  liveMatchDetail.liveState.verification.confidence * 100
                )}
                %
              </span>
            </div>
            <div className="detail-hero__scoreline">
              <div>
                <p className="detail-hero__score">
                  {liveMatchDetail.liveState.score.display}
                </p>
                <p className="detail-hero__headline">
                  {liveMatchDetail.liveState.summary.headline}
                </p>
              </div>
              <div className="detail-hero__timing">
                <strong>{liveMatchDetail.liveState.clock.display}</strong>
                <span>{liveMatchDetail.liveState.period.display}</span>
                <span>Time left: {activeTimeLeft}</span>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <section className="detail-card">
              <h3>Live pulse</h3>
              <p className="detail-modal__copy">
                {liveMatchDetail.liveState.what_is_happening.summary}
              </p>
              <div className="detail-stat-list">
                <DetailField label="Status">
                  {liveMatchDetail.liveState.match_status}
                </DetailField>
                <DetailField label="Situation code">
                  {liveMatchDetail.liveState.what_is_happening.situation_code}
                </DetailField>
                <DetailField label="Key entities">
                  {liveMatchDetail.liveState.what_is_happening.key_entity_ids.join(
                    ", "
                  )}
                </DetailField>
                <DetailField label="Momentum">
                  {liveMatchDetail.liveState.momentum.summary}
                </DetailField>
                <DetailField label="Last event">
                  {liveMatchDetail.liveState.last_major_event.description}
                </DetailField>
                <DetailField label="Likely next">
                  {
                    liveMatchDetail.liveState.live_predictions
                      .likely_next_major_event
                  }
                </DetailField>
              </div>
            </section>

            <section className="detail-card">
              <h3>Score breakdown</h3>
              <div className="detail-stat-list">
                <DetailField label="Period code">
                  {liveMatchDetail.liveState.period.code}
                </DetailField>
                <DetailField label="Elapsed seconds">
                  {liveMatchDetail.liveState.clock.elapsed_seconds}
                </DetailField>
                <DetailField label="Remaining seconds">
                  {liveMatchDetail.liveState.clock.remaining_seconds}
                </DetailField>
                <DetailField label="Score differential">
                  {liveMatchDetail.liveState.score.score_differential}
                </DetailField>
                <DetailField label="Current control">
                  {
                    liveMatchDetail.liveState.current_possession_or_control
                      .description
                  }
                </DetailField>
              </div>
              <ul className="event-card__points">
                {liveMatchDetail.liveState.score.participant_scores.map(
                  (participantScore) => (
                    <li key={participantScore.participant_id}>
                      {participantName(participantScore.participant_id)}:{" "}
                      {participantScore.display_score} (
                      {participantScore.numeric_score})
                    </li>
                  )
                )}
              </ul>
            </section>

            <section className="detail-card">
              <h3>Match context</h3>
              <div className="detail-stat-list">
                <DetailField label="Venue">
                  {formatVenueLocation(liveMatchDetail.context.match)}
                </DetailField>
                <DetailField label="Key matchup">
                  {liveMatchDetail.context.pre_match_intelligence.key_matchup}
                </DetailField>
                <DetailField label="Participants">
                  {liveMatchDetail.context.participants
                    .map((item) => item.name)
                    .join(" vs ")}
                </DetailField>
              </div>
            </section>

            <section className="detail-card">
              <h3>Competition scores</h3>
              <div className="detail-stat-list">
                <DetailField label="Excitement">
                  {liveMatchDetail.liveState.excitement.aggregate_score} (
                  {liveMatchDetail.liveState.excitement.level})
                </DetailField>
                <DetailField label="Current excitement">
                  {liveMatchDetail.liveState.excitement.current_excitement}
                </DetailField>
                <DetailField label="Recent excitement">
                  {liveMatchDetail.liveState.excitement.recent_excitement}
                </DetailField>
                <DetailField label="Expected remaining excitement">
                  {
                    liveMatchDetail.liveState.excitement
                      .expected_remaining_excitement
                  }
                </DetailField>
                <DetailField label="Criticality">
                  {liveMatchDetail.liveState.criticality.score} (
                  {liveMatchDetail.liveState.criticality.level})
                </DetailField>
                <DetailField label="Competitive balance">
                  {liveMatchDetail.liveState.competitive_balance.score} (
                  {liveMatchDetail.liveState.competitive_balance.level})
                </DetailField>
                <DetailField label="Momentum score">
                  {liveMatchDetail.liveState.momentum.score} (
                  {liveMatchDetail.liveState.momentum.direction}) for{" "}
                  {participantName(
                    liveMatchDetail.liveState.momentum.leading_participant_id
                  )}
                </DetailField>
              </div>
            </section>

            <section className="detail-card">
              <h3>Predictions</h3>
              <div className="detail-stat-list">
                <DetailField label="Comeback probability">
                  {formatProbability(
                    liveMatchDetail.liveState.live_predictions
                      .comeback_probability
                  )}
                </DetailField>
                <DetailField label="Upset probability">
                  {formatProbability(
                    liveMatchDetail.liveState.live_predictions.upset_probability
                  )}
                </DetailField>
                <DetailField label="Draw probability">
                  {formatProbability(
                    liveMatchDetail.liveState.live_predictions.draw_probability
                  )}
                </DetailField>
                <DetailField label="Overtime or tiebreak probability">
                  {formatProbability(
                    liveMatchDetail.liveState.live_predictions
                      .overtime_or_tiebreak_probability
                  )}
                </DetailField>
                <DetailField label="Expected remaining duration">
                  {
                    liveMatchDetail.liveState.live_predictions
                      .expected_remaining_duration_minutes
                  }{" "}
                  minutes
                </DetailField>
                <DetailField label="Prediction confidence">
                  {formatProbability(
                    liveMatchDetail.liveState.live_predictions
                      .prediction_confidence
                  )}
                </DetailField>
              </div>
              <div className="detail-split">
                <div>
                  <h4>Win probabilities</h4>
                  <ul className="event-card__points">
                    {liveMatchDetail.liveState.live_predictions.win_probabilities.map(
                      (prediction) => (
                        <li key={prediction.participant_id}>
                          {participantName(prediction.participant_id)}:{" "}
                          {formatProbability(prediction.probability)}
                        </li>
                      )
                    )}
                  </ul>
                </div>
                <div>
                  <h4>Recent probability change</h4>
                  <ul className="event-card__points">
                    {liveMatchDetail.liveState.live_predictions.win_probability_changes.map(
                      (prediction) => (
                        <li key={prediction.participant_id}>
                          {participantName(prediction.participant_id)}:{" "}
                          {formatSignedProbabilityChange(
                            prediction.last_interval
                          )}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </section>

            <section className="detail-card">
              <h3>Recent sequence</h3>
              <div className="detail-stat-list">
                <DetailField label="Last event id">
                  {liveMatchDetail.liveState.last_major_event.event_id}
                </DetailField>
                <DetailField label="Last event type">
                  {liveMatchDetail.liveState.last_major_event.event_type}
                </DetailField>
                <DetailField label="Last event participant">
                  {participantName(
                    liveMatchDetail.liveState.last_major_event.participant_id
                  )}
                </DetailField>
                <DetailField label="Last event player id">
                  {liveMatchDetail.liveState.last_major_event.player_id ??
                    "Unavailable"}
                </DetailField>
                <DetailField label="Last event importance">
                  {liveMatchDetail.liveState.last_major_event.event_importance}
                </DetailField>
              </div>
              <ul className="event-card__points">
                {liveMatchDetail.liveState.recent_events.length > 0 ? (
                  liveMatchDetail.liveState.recent_events.map((event) => (
                    <li key={`${event.match_time}-${event.description}`}>
                      {event.match_time}: {event.description}
                    </li>
                  ))
                ) : (
                  <li>
                    {liveMatchDetail.liveState.last_major_event.match_time}:{" "}
                    {liveMatchDetail.liveState.last_major_event.description}
                  </li>
                )}
              </ul>
            </section>

            <section className="detail-card">
              <h3>Special state and provenance</h3>
              <div className="detail-stat-list">
                <DetailField label="Verification status">
                  {liveMatchDetail.liveState.verification.status}
                </DetailField>
                <DetailField label="Generated at">
                  {liveMatchDetail.liveState.freshness.generated_at}
                </DetailField>
                <DetailField label="Source observation time">
                  {liveMatchDetail.liveState.freshness
                    .source_observation_time ?? "Unavailable"}
                </DetailField>
              </div>
              <div className="detail-split">
                <div>
                  <h4>Active flags</h4>
                  <ul className="event-card__points">
                    {activeFlags.length > 0 ? (
                      activeFlags.map((flag) => <li key={flag}>{flag}</li>)
                    ) : (
                      <li>
                        No active timeout, review, injury, weather, or tiebreak
                        flags.
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4>Reason codes</h4>
                  <ul className="event-card__points">
                    {uniqueReasonCodes.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="detail-sport-specific">
                <h4>Sport-specific state</h4>
                <div className="detail-sport-specific__grid">
                  {Object.entries(
                    liveMatchDetail.liveState.sport_specific
                  )
                    .filter(([, value]) => value !== null && value !== undefined)
                    .map(([key, value]) => (
                    <div
                      key={key}
                      className="detail-sport-specific__item"
                    >
                      <TooltipLabel
                        label={humanizeKey(key)}
                        description={getSportSpecificHelp(key)}
                      />
                      <strong>
                        {formatSportSpecificValue(key, value, participantName)}
                      </strong>
                    </div>
                    ))}
                </div>
              </div>
            </section>

            <section className="detail-card">
              <h3>What to watch</h3>
              <ul className="event-card__points">
                {liveMatchDetail.liveState.summary.key_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="detail-overlay" onClick={onClear}>
      <section
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-modal__header">
          <div>
            <p className="hero__kicker">Selected Upcoming Match</p>
            <h2 id="detail-panel-title">
              {upcomingEvent?.context.match.match_name}
            </h2>
          </div>
          <button
            type="button"
            className="detail-panel__close"
            onClick={onClear}
          >
            Close
          </button>
        </div>

        <div className="detail-hero">
          <div className="detail-hero__meta">
            <span>{upcomingEvent?.context.match.tournament_name}</span>
            <span>{upcomingEvent?.context.match.tournament_stage}</span>
            <span>
              Competitiveness{" "}
              {upcomingEvent?.upcoming_intelligence.projected_competitiveness}
            </span>
          </div>
          <div className="detail-hero__scoreline">
            <div>
              <p className="detail-hero__headline">
                {upcomingEvent?.upcoming_intelligence.headline}
              </p>
              <p className="detail-modal__copy">
                {upcomingEvent?.upcoming_intelligence.summary}
              </p>
            </div>
            <div className="detail-hero__timing">
              <strong>
                {upcomingEvent
                  ? new Date(
                      upcomingEvent.context.match.scheduled_start_time
                    ).toLocaleString()
                  : ""}
              </strong>
              <span>Upcoming</span>
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <section className="detail-card">
            <h3>Why it matters</h3>
            <ul className="event-card__points">
              {upcomingEvent?.upcoming_intelligence.watch_reasons.map(
                (reason) => (
                  <li key={reason}>{reason}</li>
                )
              )}
            </ul>
          </section>

          <section className="detail-card">
            <h3>Match context</h3>
            <div className="detail-stat-list">
              <DetailField label="Venue">
                {upcomingEvent
                  ? formatVenueLocation(upcomingEvent.context.match)
                  : null}
              </DetailField>
              <DetailField label="Key matchup">
                {upcomingEvent?.context.pre_match_intelligence.key_matchup}
              </DetailField>
              <DetailField label="Participants">
                {upcomingEvent?.context.participants
                  .map((item) => item.name)
                  .join(" vs ")}
              </DetailField>
            </div>
          </section>

          <section className="detail-card">
            <h3>Pre-match forecast</h3>
            <div className="detail-stat-list">
              <DetailField label="Projected competitiveness">
                {upcomingEvent?.upcoming_intelligence.projected_competitiveness}
              </DetailField>
              <DetailField label="Context competitiveness">
                {
                  upcomingEvent?.context.pre_match_intelligence
                    .expected_competitiveness
                }
              </DetailField>
              <DetailField label="Generated at">
                {upcomingEvent?.freshness.generated_at}
              </DetailField>
            </div>
            <div className="detail-split">
              <div>
                <h4>
                  <TooltipLabel
                    label="Win probabilities"
                    description={getAttributeHelp("Win probabilities")}
                  />
                </h4>
                <ul className="event-card__points">
                  {upcomingEvent?.upcoming_intelligence.win_probabilities.map(
                    (prediction) => (
                      <li key={prediction.participant_id}>
                        {formatParticipantName(
                          upcomingEvent.context,
                          prediction.participant_id
                        )}
                        : {formatProbability(prediction.probability)}
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div>
                <h4>Pre-match intelligence</h4>
                <ul className="event-card__points">
                  <li>{upcomingEvent?.context.pre_match_intelligence.headline}</li>
                  <li>{upcomingEvent?.context.pre_match_intelligence.summary}</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
