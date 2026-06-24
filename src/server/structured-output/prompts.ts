import type {
  DiscoverRequest,
  MatchIdentity,
  UpcomingQuery
} from "../../shared/schemas/live";
import { renderJsonInput } from "./schemas";

const currentTime = (): string => new Date().toISOString();
const outputFormattingRules = [
  "Use RFC3339 / ISO 8601 timestamps with timezone, preferably UTC Z format such as 2026-06-17T01:46:06Z.",
  "Use 0-100 numeric scales for competitiveness, excitement, criticality, and related aggregate scoring fields unless a probability field explicitly requires 0-1.",
  "If a field is unknown, use null only where the schema allows it instead of inventing placeholders."
].join(" ");

const scoreCalibrationRules = [
  "Calibrate numeric scores so they are internally consistent.",
  "If a top-level score is low, its related descriptive level and component scores must also stay low unless a clear reason code justifies otherwise.",
  "For live_state.watchability, make current_score broadly reflect tension_score, scoring_imminence_score, swing_potential_score, state_clarity_score, and evidence_strength_score rather than contradict them.",
  "For upcoming_intelligence.audience_signals, make audience_interest_score reflect stakes_score, star_power_score, volatility_score, upset_potential_score, and narrative_strength_score rather than repeating the same number everywhere.",
  "Do not default to generic 50 or 55/45 style values unless the evidence really is balanced."
].join(" ");

const buildSupportedSportsRule = (sport: string): string =>
  sport === "all"
    ? "This MVP currently supports basketball, soccer, american-football, baseball, cricket, hockey, tennis, and mma. If sport=all, return only matches from those sports."
    : `Return only matches for the requested sport=${sport}.`;

const sportSpecificRule =
  "For live_state.sport_specific, use only these keys: quarter, shot_clock_seconds, foul_pressure, phase, stoppage_time_minutes, pressure_side, attacking_side, possession_team, down, distance_yards, yard_line, red_zone, inning, innings_half, outs, balls, strikes, runners_on_base, over, wickets, run_rate, target_runs, power_play, period_number, pulled_goalie, current_set, set_score, serve_side, break_point_pressure, round, control_time_seconds, finish_threat. Always include all keys, and use null for keys that do not apply to the current sport.";

const activePlayersRule =
  "For live_state.active_players, return the most relevant currently active players for the sport and moment. Examples: in cricket include the current batsmen and bowler; in basketball include the players currently driving the game; in american football include the quarterback or ball-carriers involved in the live drive; in baseball include the batter, pitcher, and key baserunners; in hockey include skaters or goalie shaping the phase; in tennis include the server and pressured opponent; in mma include the two fighters with the current control or finish threat. Prefer 2 to 4 players when the match is live. Do not include substituted-out or inactive players. Each entry must include player_id, player_name, participant_id, role, status, impact_summary, and short key_metrics.";

const liveScoringRule =
  "For live_state, always return watchability with current_score, tension_score, scoring_imminence_score, swing_potential_score, state_clarity_score, and evidence_strength_score. These scores should help a programmatic consumer understand how worth-watching the live match is right now and how trustworthy the current state is.";

const upcomingAudienceRule =
  "For upcoming_intelligence, always return audience_signals with audience_interest_score, stakes_score, star_power_score, volatility_score, upset_potential_score, and narrative_strength_score. These scores should help a programmatic consumer rank how compelling the upcoming match is for a broad audience.";

const crossPhaseScoresRule =
  "For both live_state and upcoming_intelligence, always return cross_phase_scores with stakes_score, star_power_score, upset_potential_score, and narrative_strength_score. Keep these durable across the match lifecycle: they should describe the matchup's underlying importance, draw, surprise potential, and story strength rather than the immediate moment-to-moment state.";

const matchStatusRule =
  "For live_state.match_status, use live when normal play is active, paused for short temporary stops, suspended for longer in-progress halts, completed when the match is over, postponed when it will not proceed as scheduled, cancelled when it will not be played, and unverified only when the true state cannot be confirmed. Always populate special_state.is_paused, is_postponed, is_cancelled, is_suspended, pause_reason, and status_reason consistently with match_status and the observed reason for the stoppage.";

export const buildDiscoveryPrompt = (
  input: DiscoverRequest,
  options?: { mode?: "default" | "live_recheck" }
) => ({
  instructions: [
    "You are discovering currently live sports matches for a machine-readable sports intelligence API.",
    "Use web search to verify currently live matches from recent and authoritative sources before returning any event.",
    buildSupportedSportsRule(input.sport),
    "Return only currently live or newly completed matches that can be confidently verified.",
    "Do not return future scheduled fixtures, pre-match placeholders, or matches that have not yet kicked off in the live discovery endpoint.",
    "If the available evidence says a match has not started yet, omit it entirely instead of returning an unverified or pre_match live event.",
    "Do not use 00:00 pre-match placeholder clocks, 0-0 kickoff defaults, or schedule-only summaries as live discovery output.",
    options?.mode === "live_recheck"
      ? "This is a second-pass live recheck because an earlier discovery call returned no usable live events. Re-check authoritative live-score and match-center sources carefully before concluding that no live matches are available."
      : "",
    options?.mode === "live_recheck"
      ? "Prefer current match-center, live-score, or play-by-play evidence over stale schedule listings when they disagree about whether a match is in progress."
      : "",
    options?.mode === "live_recheck"
      ? "Pay close attention to kickoff timezone conversion and do not misclassify an already-started match as future or pre-match."
      : "",
    "For each live match, return the combined live event object with context and live_state.",
    "Use context_status=new for newly discovered matches, unchanged when the supplied fingerprint is still valid, updated when context materially changed, and unavailable only when context cannot be verified.",
    sportSpecificRule,
    activePlayersRule,
    liveScoringRule,
    crossPhaseScoresRule,
    matchStatusRule,
    "Keep freshness timestamps realistic and concise.",
    "Return warnings only when necessary.",
    outputFormattingRules,
    scoreCalibrationRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "discover_live_matches",
    ...input
  })
});

export const buildStateRefreshPrompt = (input: {
  region: string;
  sport: string;
  matches: MatchIdentity[];
}) => ({
  instructions: [
    "You are refreshing only the dynamic state of already-known live sports matches.",
    "Use web search to verify the current live state from recent and authoritative sources before returning any update.",
    buildSupportedSportsRule(input.sport),
    "Do not return static match context unless required to correct identity.",
    "Do not repeat venue, rivalry history, full participant profiles, full head-to-head history, pre-match anticipation factors, or other static fields.",
    "For each supplied match: verify whether it is still live, return current status, score, progression, what is happening now, recent meaningful events, and updated excitement, criticality, competitive balance, momentum, and live predictions.",
    sportSpecificRule,
    activePlayersRule,
    liveScoringRule,
    crossPhaseScoresRule,
    matchStatusRule,
    "If a match cannot be verified, omit it from states and add it to failed_matches with a concise code and message.",
    "Keep summaries concise and do not invent precision.",
    outputFormattingRules,
    scoreCalibrationRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "refresh_live_states",
    ...input
  })
});

export const buildLiveLookupPrompt = (matchId: string) => ({
  instructions: [
    "You are locating a single live sports match for a machine-readable API lookup.",
    "Use web search to verify the current match state from recent and authoritative sources.",
    "The stable match_id encodes sport, competition, date, and participants.",
    "If you can verify the match, return one combined live event object.",
    sportSpecificRule,
    activePlayersRule,
    liveScoringRule,
    crossPhaseScoresRule,
    matchStatusRule,
    "If you cannot verify the match, return event=null.",
    outputFormattingRules,
    scoreCalibrationRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "lookup_single_live_event",
    match_id: matchId
  })
});

export const buildContextLookupPrompt = (matchId: string) => ({
  instructions: [
    "You are locating only the static or slow-moving context for a single sports match.",
    "Use web search to verify the match details from authoritative sources when needed.",
    "Return only the context object if the match can be verified.",
    "Do not include live_state in the response.",
    "If the match cannot be verified, return context=null.",
    outputFormattingRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "lookup_single_match_context",
    match_id: matchId
  })
});

export const buildStateLookupPrompt = (matchId: string) => ({
  instructions: [
    "You are locating only the dynamic live state for a single sports match.",
    "Use web search to verify the current live state from recent and authoritative sources.",
    "Return only live_state if the match can be verified.",
    "Do not include static context fields in the response.",
    sportSpecificRule,
    activePlayersRule,
    liveScoringRule,
    crossPhaseScoresRule,
    matchStatusRule,
    "If the match cannot be verified, return live_state=null.",
    outputFormattingRules,
    scoreCalibrationRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "lookup_single_match_state",
    match_id: matchId
  })
});

export const buildUpcomingPrompt = (input: UpcomingQuery) => ({
  instructions: [
    "You are generating upcoming sports intelligence for a machine-readable API.",
    "Use web search to verify upcoming matches in the requested window from recent and authoritative sources before returning any event.",
    buildSupportedSportsRule(input.sport),
    "Return only upcoming matches within the requested region, sport, and time window.",
    "Include matches later today that have not started yet; those same-day upcoming matches belong in this endpoint and should not be omitted just because kickoff is soon.",
    "For each upcoming event, return context and pre-match intelligence with realistic watch reasons and win probabilities.",
    crossPhaseScoresRule,
    upcomingAudienceRule,
    "Return 3 to 5 concrete watch_reasons. Avoid generic filler such as simply saying a game is important or competitive without giving a specific reason.",
    "Do not return already live matches.",
    "Return warnings only when necessary.",
    outputFormattingRules,
    scoreCalibrationRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "upcoming_match_intelligence",
    ...input
  })
});

export const buildUpcomingLookupPrompt = (matchId: string) => ({
  instructions: [
    "You are locating one upcoming sports match for a machine-readable API lookup.",
    "Use web search to verify the upcoming match from recent and authoritative sources.",
    "Return one upcoming event object if the match can be verified.",
    crossPhaseScoresRule,
    upcomingAudienceRule,
    "If the match cannot be verified or is no longer upcoming, return event=null.",
    outputFormattingRules,
    scoreCalibrationRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "lookup_single_upcoming_match",
    match_id: matchId
  })
});
