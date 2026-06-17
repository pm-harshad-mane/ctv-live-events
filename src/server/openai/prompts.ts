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

const buildSupportedSportsRule = (sport: string): string =>
  sport === "all"
    ? "This MVP currently supports basketball, soccer, american-football, baseball, cricket, hockey, tennis, and mma. If sport=all, return only matches from those sports."
    : `Return only matches for the requested sport=${sport}.`;

const sportSpecificRule =
  "For live_state.sport_specific, use only these keys: quarter, shot_clock_seconds, foul_pressure, phase, stoppage_time_minutes, pressure_side, attacking_side, possession_team, down, distance_yards, yard_line, red_zone, inning, innings_half, outs, balls, strikes, runners_on_base, over, wickets, run_rate, target_runs, power_play, period_number, pulled_goalie, current_set, set_score, serve_side, break_point_pressure, round, control_time_seconds, finish_threat. Always include all keys, and use null for keys that do not apply to the current sport.";

const activePlayersRule =
  "For live_state.active_players, return the most relevant currently active players for the sport and moment. Examples: in cricket include the current batsmen and bowler; in basketball include the players currently driving the game; in american football include the quarterback or ball-carriers involved in the live drive; in baseball include the batter, pitcher, and key baserunners; in hockey include skaters or goalie shaping the phase; in tennis include the server and pressured opponent; in mma include the two fighters with the current control or finish threat. Each entry must include player_id, player_name, participant_id, role, status, impact_summary, and short key_metrics.";

export const buildDiscoveryPrompt = (input: DiscoverRequest) => ({
  instructions: [
    "You are discovering currently live sports matches for a machine-readable sports intelligence API.",
    "Use web search to verify currently live matches from recent and authoritative sources before returning any event.",
    buildSupportedSportsRule(input.sport),
    "Return only currently live or newly completed matches that can be confidently verified.",
    "For each live match, return the combined live event object with context and live_state.",
    "Use context_status=new for newly discovered matches, unchanged when the supplied fingerprint is still valid, updated when context materially changed, and unavailable only when context cannot be verified.",
    sportSpecificRule,
    activePlayersRule,
    "Keep freshness timestamps realistic and concise.",
    "Return warnings only when necessary.",
    outputFormattingRules
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
    "If a match cannot be verified, omit it from states and add it to failed_matches with a concise code and message.",
    "Keep summaries concise and do not invent precision.",
    outputFormattingRules
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
    "If you cannot verify the match, return event=null.",
    outputFormattingRules
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
    "If the match cannot be verified, return live_state=null.",
    outputFormattingRules
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
    "For each upcoming event, return context and pre-match intelligence with realistic watch reasons and win probabilities.",
    "Do not return already live matches.",
    "Return warnings only when necessary.",
    outputFormattingRules
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
    "If the match cannot be verified or is no longer upcoming, return event=null.",
    outputFormattingRules
  ].join(" "),
  input: renderJsonInput({
    current_time_utc: currentTime(),
    task: "lookup_single_upcoming_match",
    match_id: matchId
  })
});
