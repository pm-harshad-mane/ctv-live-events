import type {
  LiveEvent,
  LiveState,
  MatchContext,
  MatchIdentity,
  Participant,
  UpcomingEvent
} from "../../../shared/schemas/live";

type MatchSeed = {
  region: string;
  identity: MatchIdentity;
  context: MatchContext;
  scoreSeed: [number, number];
  momentumParticipantId: string;
};

type UpcomingSeed = {
  region: string;
  match_id: string;
  context: MatchContext;
  upcoming_intelligence: UpcomingEvent["upcoming_intelligence"];
};

const buildWatchability = (
  values: LiveState["watchability"]
): LiveState["watchability"] => values;

const buildCrossPhaseScores = <
  T extends
    | LiveState["cross_phase_scores"]
    | UpcomingEvent["upcoming_intelligence"]["cross_phase_scores"]
>(
  values: T
): T => values;

const buildAudienceSignals = (
  values: UpcomingEvent["upcoming_intelligence"]["audience_signals"]
): UpcomingEvent["upcoming_intelligence"]["audience_signals"] => values;

const buildUpcomingIntelligence = (
  intelligence: UpcomingEvent["upcoming_intelligence"]
): UpcomingEvent["upcoming_intelligence"] => intelligence;

const nowIso = (): string => new Date().toISOString();

const matchesRegion = (seedRegion: string, requestedRegion: string): boolean =>
  requestedRegion === "global" || seedRegion === requestedRegion;

const sportSpecificBase = (): LiveState["sport_specific"] => ({
  quarter: null,
  shot_clock_seconds: null,
  foul_pressure: null,
  phase: null,
  stoppage_time_minutes: null,
  pressure_side: null,
  attacking_side: null,
  possession_team: null,
  down: null,
  distance_yards: null,
  yard_line: null,
  red_zone: null,
  inning: null,
  innings_half: null,
  outs: null,
  balls: null,
  strikes: null,
  runners_on_base: null,
  over: null,
  wickets: null,
  run_rate: null,
  target_runs: null,
  power_play: null,
  period_number: null,
  pulled_goalie: null,
  current_set: null,
  set_score: null,
  serve_side: null,
  break_point_pressure: null,
  round: null,
  control_time_seconds: null,
  finish_threat: null
});

const buildParticipantScores = (
  seed: MatchSeed,
  homeScore: number,
  awayScore: number
): LiveState["score"]["participant_scores"] => [
  {
    participant_id: seed.identity.participants[0].participant_id,
    display_score: String(homeScore),
    numeric_score: homeScore
  },
  {
    participant_id: seed.identity.participants[1].participant_id,
    display_score: String(awayScore),
    numeric_score: awayScore
  }
];

const buildWinProbabilities = (
  seed: MatchSeed,
  homeProbability: number
): LiveState["live_predictions"]["win_probabilities"] => [
  {
    participant_id: seed.identity.participants[0].participant_id,
    probability: homeProbability
  },
  {
    participant_id: seed.identity.participants[1].participant_id,
    probability: 1 - homeProbability
  }
];

const buildWinProbabilityChanges = (
  seed: MatchSeed,
  homeDelta: number
): LiveState["live_predictions"]["win_probability_changes"] => [
  {
    participant_id: seed.identity.participants[0].participant_id,
    last_interval: homeDelta
  },
  {
    participant_id: seed.identity.participants[1].participant_id,
    last_interval: -homeDelta
  }
];

const leadingParticipantId = (
  seed: MatchSeed,
  homeScore: number,
  awayScore: number
): string =>
  homeScore >= awayScore
    ? seed.identity.participants[0].participant_id
    : seed.identity.participants[1].participant_id;

const buildActivePlayers = (
  seed: MatchSeed,
  sport: MatchIdentity["sport"],
  minuteOffset: number
): LiveState["active_players"] => {
  const home = seed.identity.participants[0];
  const away = seed.identity.participants[1];

  switch (sport) {
    case "basketball":
      return [
        {
          player_id: `${home.participant_id}-lead-guard`,
          player_name: `${home.name} Lead Guard`,
          participant_id: home.participant_id,
          role: "Primary ball handler",
          status: "On court",
          impact_summary:
            "Driving the offense and creating the highest-leverage looks late.",
          key_metrics: [
            { label: "Points", value: `${24 + minuteOffset}` },
            { label: "Assists", value: `${7 + (minuteOffset % 3)}` }
          ]
        },
        {
          player_id: `${away.participant_id}-wing-scorer`,
          player_name: `${away.name} Wing Scorer`,
          participant_id: away.participant_id,
          role: "Primary scorer",
          status: "On court",
          impact_summary:
            "Keeping the game close through shot creation and late-clock usage.",
          key_metrics: [
            { label: "Points", value: `${22 + minuteOffset}` },
            { label: "3PT", value: `${3 + (minuteOffset % 3)}` }
          ]
        }
      ];
    case "soccer":
      return [
        {
          player_id: `${home.participant_id}-forward`,
          player_name: `${home.name} Central Forward`,
          participant_id: home.participant_id,
          role: "Attacker",
          status: "Active",
          impact_summary:
            "Stretching the back line and staying involved in the biggest transitions.",
          key_metrics: [
            { label: "Shots", value: `${2 + (minuteOffset % 3)}` },
            { label: "Touches box", value: `${5 + minuteOffset}` }
          ]
        },
        {
          player_id: `${away.participant_id}-keeper`,
          player_name: `${away.name} Goalkeeper`,
          participant_id: away.participant_id,
          role: "Goalkeeper",
          status: "Active",
          impact_summary:
            "Keeping the margin intact with high-leverage interventions.",
          key_metrics: [
            { label: "Saves", value: `${3 + (minuteOffset % 2)}` },
            { label: "Claims", value: `${1 + (minuteOffset % 2)}` }
          ]
        }
      ];
    case "american-football":
      return [
        {
          player_id: `${home.participant_id}-qb`,
          player_name: `${home.name} Quarterback`,
          participant_id: home.participant_id,
          role: "Quarterback",
          status: "Current drive",
          impact_summary:
            "Controlling the live possession and directing the tempo of the drive.",
          key_metrics: [
            { label: "Pass yds", value: `${248 + minuteOffset * 8}` },
            { label: "TD", value: `${2 + (minuteOffset % 2)}` }
          ]
        },
        {
          player_id: `${away.participant_id}-edge`,
          player_name: `${away.name} Edge Rusher`,
          participant_id: away.participant_id,
          role: "Pass rusher",
          status: "On field",
          impact_summary:
            "Threatening the pocket and shaping down-and-distance decisions.",
          key_metrics: [
            { label: "Sacks", value: `${1 + (minuteOffset % 2)}` },
            { label: "Pressures", value: `${5 + minuteOffset}` }
          ]
        }
      ];
    case "baseball":
      return [
        {
          player_id: `${away.participant_id}-batter`,
          player_name: `${away.name} Cleanup Hitter`,
          participant_id: away.participant_id,
          role: "Current batter",
          status: "At plate",
          impact_summary:
            "Represents the biggest immediate run-producing threat in the inning.",
          key_metrics: [
            { label: "Count", value: "2-1" },
            { label: "RBI", value: `${1 + (minuteOffset % 2)}` }
          ]
        },
        {
          player_id: `${home.participant_id}-pitcher`,
          player_name: `${home.name} Late Reliever`,
          participant_id: home.participant_id,
          role: "Pitcher",
          status: "On mound",
          impact_summary:
            "Trying to escape the inning without allowing the decisive run.",
          key_metrics: [
            { label: "Pitches", value: `${14 + minuteOffset}` },
            { label: "K", value: `${2 + (minuteOffset % 2)}` }
          ]
        }
      ];
    case "cricket":
      return [
        {
          player_id: `${home.participant_id}-striker`,
          player_name: `${home.name} Set Batter`,
          participant_id: home.participant_id,
          role: "Striker",
          status: "Batting",
          impact_summary:
            "Anchoring the chase while still able to clear the infield.",
          key_metrics: [
            { label: "Runs", value: `${46 + minuteOffset * 2}` },
            { label: "Balls", value: `${31 + minuteOffset}` }
          ]
        },
        {
          player_id: `${away.participant_id}-bowler`,
          player_name: `${away.name} Death Bowler`,
          participant_id: away.participant_id,
          role: "Bowler",
          status: "Current over",
          impact_summary:
            "The live over is leaning on yorker execution and wicket pressure.",
          key_metrics: [
            { label: "Figures", value: `3-${28 + minuteOffset}` },
            {
              label: "Economy",
              value: `${(7.2 + minuteOffset * 0.1).toFixed(1)}`
            }
          ]
        }
      ];
    case "hockey":
      return [
        {
          player_id: `${home.participant_id}-center`,
          player_name: `${home.name} Top-Line Center`,
          participant_id: home.participant_id,
          role: "Center",
          status: "On ice",
          impact_summary:
            "Driving offensive-zone entries and touch volume on the cycle.",
          key_metrics: [
            { label: "Shots", value: `${4 + (minuteOffset % 3)}` },
            { label: "Faceoffs", value: `${8 + minuteOffset}` }
          ]
        },
        {
          player_id: `${away.participant_id}-goalie`,
          player_name: `${away.name} Goaltender`,
          participant_id: away.participant_id,
          role: "Goalie",
          status: "On ice",
          impact_summary:
            "Absorbing sustained pressure and keeping the margin from breaking open.",
          key_metrics: [
            { label: "Saves", value: `${24 + minuteOffset}` },
            { label: "SV%", value: ".927" }
          ]
        }
      ];
    case "tennis":
      return [
        {
          player_id: `${home.participant_id}-server`,
          player_name: `${home.name}`,
          participant_id: home.participant_id,
          role: "Server",
          status: "Serving",
          impact_summary:
            "Trying to hold through a tense service game and preserve scoreboard edge.",
          key_metrics: [
            { label: "1st serve", value: "67%" },
            { label: "Winners", value: `${18 + minuteOffset}` }
          ]
        },
        {
          player_id: `${away.participant_id}-receiver`,
          player_name: `${away.name}`,
          participant_id: away.participant_id,
          role: "Returner",
          status: "Receiving",
          impact_summary:
            "Pressuring the second serve and forcing longer baseline exchanges.",
          key_metrics: [
            { label: "Break pts", value: `${1 + (minuteOffset % 2)}/4` },
            { label: "Unforced", value: `${10 + minuteOffset}` }
          ]
        }
      ];
    case "mma":
      return [
        {
          player_id: `${home.participant_id}-fighter`,
          player_name: `${home.name}`,
          participant_id: home.participant_id,
          role: "Fighter",
          status: "Pressuring",
          impact_summary:
            "Owning more of the cage position and forcing the cleaner exchanges.",
          key_metrics: [
            { label: "Control", value: `${48 + minuteOffset * 6}s` },
            { label: "Sig. strikes", value: `${26 + minuteOffset}` }
          ]
        },
        {
          player_id: `${away.participant_id}-fighter`,
          player_name: `${away.name}`,
          participant_id: away.participant_id,
          role: "Fighter",
          status: "Responding",
          impact_summary:
            "Looking for clean counters and moments to reverse the round optics.",
          key_metrics: [
            { label: "Sig. strikes", value: `${21 + minuteOffset}` },
            { label: "Takedown def.", value: "78%" }
          ]
        }
      ];
    default:
      return [];
  }
};

const buildBasketballState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const remainingSeconds = Math.max(24, 720 - minuteOffset * 11);
  const leader = leadingParticipantId(seed, homeScore, awayScore);
  const isTimeout = remainingSeconds < 120 && minuteOffset % 3 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: remainingSeconds <= 30 ? "completed" : isTimeout ? "paused" : "live",
    period: {
      code: remainingSeconds <= 180 ? "fourth_quarter" : "third_quarter",
      display: remainingSeconds <= 180 ? "4th Quarter" : "3rd Quarter"
    },
    clock: {
      display: `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
        remainingSeconds % 60
      ).padStart(2, "0")}`,
      elapsed_seconds: 2880 - remainingSeconds,
      remaining_seconds: remainingSeconds
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      quarter: remainingSeconds <= 180 ? 4 : 3,
      shot_clock_seconds: Math.max(2, 24 - (minuteOffset % 20)),
      foul_pressure:
        homeScore >= awayScore ? "away_bonus_watch" : "home_bonus_watch",
      possession_team: seed.momentumParticipantId
    },
    current_possession_or_control: {
      participant_id: seed.momentumParticipantId,
      description:
        leader === seed.identity.participants[0].participant_id
          ? `${seed.identity.participants[0].name} is bringing the ball up in a half-court set`
          : `${seed.identity.participants[1].name} controls the possession after the latest score`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "Late-game pressure is rising",
      summary: `${seed.identity.participants[0].name} and ${seed.identity.participants[1].name} are in a tight finish.`,
      situation_code: "close_finish",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "score",
      participant_id: leader,
      player_id: `${leader}-featured-player`,
      description: "Recent scoring run tightened the game",
      match_time: `${String(Math.floor(remainingSeconds / 60))}:${String(
        remainingSeconds % 60
      ).padStart(2, "0")}`,
      event_importance: 88
    },
    recent_events: [
      {
        description: "Momentum shifted after a quick scoring burst",
        match_time: "03:12"
      }
    ],
    special_state: {
      is_timeout: isTimeout,
      is_under_review: false,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false,
      is_paused: isTimeout,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isTimeout ? "timeout" : null,
      status_reason: isTimeout ? "Late timeout stopped live play briefly." : null
    },
    excitement: {
      aggregate_score: 90,
      level: "high",
      current_excitement: 91,
      recent_excitement: 88,
      expected_remaining_excitement: 93,
      reason_codes: ["close_score", "late_match", "rapid_scoring_run"]
    },
    criticality: {
      score: 86,
      level: "high",
      reason_codes: ["late_match", "close_score", "playoff_positioning"]
    },
    competitive_balance: {
      score: 92,
      level: "very_close"
    },
    watchability: buildWatchability({
      current_score: 91,
      tension_score: 90,
      scoring_imminence_score: 82,
      swing_potential_score: 88,
      state_clarity_score: 83,
      evidence_strength_score: 82
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 79,
      star_power_score: 82,
      upset_potential_score: 46,
      narrative_strength_score: 74
    }),
    momentum: {
      leading_participant_id: seed.momentumParticipantId,
      score: 76,
      direction: "increasing",
      summary: "One team is sustaining pressure across several possessions",
      reason_codes: ["shot_quality_edge", "back_to_back_scores"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        homeScore >= awayScore ? 0.57 : 0.43
      ),
      win_probability_changes: buildWinProbabilityChanges(
        seed,
        homeScore >= awayScore ? 0.06 : -0.06
      ),
      comeback_probability: homeScore === awayScore ? 0.5 : 0.41,
      upset_probability: 0.28,
      draw_probability: 0.01,
      overtime_or_tiebreak_probability:
        Math.abs(homeScore - awayScore) <= 2 ? 0.18 : 0.08,
      likely_next_major_event: "score",
      expected_remaining_duration_minutes: Math.max(
        1,
        Math.round(remainingSeconds / 60)
      ),
      prediction_confidence: 0.82
    },
    summary: {
      headline: "A close live game remains unsettled",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore}.`,
      key_points: [
        "The score is tight",
        "Momentum remains fluid",
        "The next scoring play could swing the game"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.82,
      warnings: []
    }
  };
};

const buildSoccerState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const elapsedMinutes = Math.min(89, 52 + minuteOffset * 2);
  const remainingSeconds = Math.max(60, (90 - elapsedMinutes) * 60);
  const leader = leadingParticipantId(seed, homeScore, awayScore);
  const isLevel = homeScore === awayScore;
  const isUnderReview = elapsedMinutes >= 70 && minuteOffset % 4 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: elapsedMinutes >= 89 ? "completed" : isUnderReview ? "paused" : "live",
    period: {
      code: elapsedMinutes >= 45 ? "second_half" : "first_half",
      display: elapsedMinutes >= 45 ? "2nd Half" : "1st Half"
    },
    clock: {
      display: `${elapsedMinutes}'`,
      elapsed_seconds: elapsedMinutes * 60,
      remaining_seconds: remainingSeconds
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      phase:
        elapsedMinutes >= 45 ? "open_second_half" : "controlled_first_half",
      stoppage_time_minutes: elapsedMinutes >= 88 ? 4 : 0,
      pressure_side: seed.momentumParticipantId,
      attacking_side: seed.momentumParticipantId
    },
    current_possession_or_control: {
      participant_id: seed.momentumParticipantId,
      description:
        seed.momentumParticipantId ===
        seed.identity.participants[0].participant_id
          ? `${seed.identity.participants[0].name} is holding territory in the attacking half`
          : `${seed.identity.participants[1].name} is circulating possession and forcing deeper defending`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: isLevel
        ? "The match is level entering the final stretch"
        : "One goal still separates the sides",
      summary: `${seed.identity.participants[0].name} and ${seed.identity.participants[1].name} are trading pressure in the second half.`,
      situation_code: isLevel ? "level_match" : "narrow_lead",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "goal",
      participant_id: leader,
      player_id: `${leader}-scorer`,
      description: isLevel
        ? "An equalizer brought the match back level"
        : "A composed finish restored the edge",
      match_time: `${elapsedMinutes - 4}'`,
      event_importance: 83
    },
    recent_events: [
      {
        description: "A transition chance forced a reaction save",
        match_time: `${elapsedMinutes - 6}'`
      }
    ],
    special_state: {
      is_timeout: false,
      is_under_review: isUnderReview,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false,
      is_paused: isUnderReview,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isUnderReview ? "video review" : null,
      status_reason: isUnderReview
        ? "Play is paused while the officials complete a video review."
        : null
    },
    excitement: {
      aggregate_score: 84,
      level: "high",
      current_excitement: isLevel ? 86 : 82,
      recent_excitement: 80,
      expected_remaining_excitement: 85,
      reason_codes: ["one_goal_margin", "late_phase", "transition_threats"]
    },
    criticality: {
      score: 80,
      level: "high",
      reason_codes: ["late_match", "table_implications", "narrow_lead"]
    },
    competitive_balance: {
      score: isLevel ? 95 : 86,
      level: isLevel ? "level" : "close"
    },
    watchability: buildWatchability({
      current_score: isLevel ? 87 : 82,
      tension_score: isLevel ? 89 : 81,
      scoring_imminence_score: 73,
      swing_potential_score: isLevel ? 86 : 78,
      state_clarity_score: 80,
      evidence_strength_score: 79
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 71,
      star_power_score: 78,
      upset_potential_score: 63,
      narrative_strength_score: 76
    }),
    momentum: {
      leading_participant_id: seed.momentumParticipantId,
      score: 71,
      direction: "increasing",
      summary:
        "Recent field position and shot volume suggest building pressure",
      reason_codes: ["territory_gain", "shot_volume_increase"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        isLevel ? 0.39 : homeScore > awayScore ? 0.6 : 0.28
      ),
      win_probability_changes: buildWinProbabilityChanges(
        seed,
        isLevel ? 0.02 : homeScore > awayScore ? 0.08 : -0.08
      ),
      comeback_probability: isLevel
        ? 0.5
        : leader === seed.identity.participants[0].participant_id
          ? 0.32
          : 0.46,
      upset_probability: 0.24,
      draw_probability: isLevel ? 0.27 : 0.16,
      overtime_or_tiebreak_probability: 0,
      likely_next_major_event: "shot_on_target",
      expected_remaining_duration_minutes: Math.max(1, 90 - elapsedMinutes),
      prediction_confidence: 0.77
    },
    summary: {
      headline: isLevel
        ? "The match remains in the balance late on"
        : "The lead is narrow with time still to play",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore} in the ${elapsedMinutes}th minute.`,
      key_points: [
        "The match is still within one decisive moment",
        "Pressure has increased in the second half",
        "A single transition could swing momentum"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.79,
      warnings: []
    }
  };
};

const buildFootballState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const quarter = minuteOffset >= 6 ? 4 : 3;
  const quarterRemaining = Math.max(18, 900 - minuteOffset * 95);
  const leader = leadingParticipantId(seed, homeScore, awayScore);
  const possessionTeam =
    minuteOffset % 2 === 0
      ? seed.identity.participants[0].participant_id
      : seed.identity.participants[1].participant_id;
  const isTimeout = minuteOffset % 3 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: isTimeout ? "paused" : "live",
    period: {
      code: quarter === 4 ? "fourth_quarter" : "third_quarter",
      display: quarter === 4 ? "4th Quarter" : "3rd Quarter"
    },
    clock: {
      display: `${String(Math.floor(quarterRemaining / 60)).padStart(2, "0")}:${String(
        quarterRemaining % 60
      ).padStart(2, "0")}`,
      elapsed_seconds: 3600 - quarterRemaining,
      remaining_seconds: quarterRemaining
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      possession_team: possessionTeam,
      down: (minuteOffset % 4) + 1,
      distance_yards: 3 + (minuteOffset % 8),
      yard_line: `${28 + minuteOffset * 4}`,
      red_zone: quarterRemaining < 220,
      pressure_side: possessionTeam
    },
    current_possession_or_control: {
      participant_id: possessionTeam,
      description: `${seed.identity.participants.find((participant) => participant.participant_id === possessionTeam)?.name} has the ball with the drive still alive`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "A one-possession NFL finish is developing",
      summary:
        "Field position and timeout leverage are starting to dominate every snap.",
      situation_code: "one_possession_game",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "explosive_play",
      participant_id: leader,
      player_id: `${leader}-skill-player`,
      description: "A chunk gain moved the offense into scoring range",
      match_time: `${Math.floor(quarterRemaining / 60)}:${String(
        quarterRemaining % 60
      ).padStart(2, "0")}`,
      event_importance: 86
    },
    recent_events: [
      {
        description: "A third-down conversion extended the drive",
        match_time: "06:42"
      }
    ],
    special_state: {
      is_timeout: isTimeout,
      is_under_review: false,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false,
      is_paused: isTimeout,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isTimeout ? "team timeout" : null,
      status_reason: isTimeout ? "The current drive is paused during a timeout." : null
    },
    excitement: {
      aggregate_score: 88,
      level: "high",
      current_excitement: 89,
      recent_excitement: 84,
      expected_remaining_excitement: 91,
      reason_codes: ["one_score_margin", "late_drive", "red_zone_access"]
    },
    criticality: {
      score: 87,
      level: "high",
      reason_codes: ["late_game", "timeout_leverage", "field_position"]
    },
    competitive_balance: {
      score: 85,
      level: "close"
    },
    watchability: buildWatchability({
      current_score: 86,
      tension_score: 88,
      scoring_imminence_score: quarterRemaining < 220 ? 81 : 70,
      swing_potential_score: 84,
      state_clarity_score: 82,
      evidence_strength_score: 80
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 84,
      star_power_score: 87,
      upset_potential_score: 54,
      narrative_strength_score: 85
    }),
    momentum: {
      leading_participant_id: possessionTeam,
      score: 74,
      direction: "increasing",
      summary: "The current drive is putting sustained stress on the defense",
      reason_codes: ["successful_early_downs", "field_position_gain"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        homeScore >= awayScore ? 0.58 : 0.42
      ),
      win_probability_changes: buildWinProbabilityChanges(
        seed,
        possessionTeam === seed.identity.participants[0].participant_id
          ? 0.05
          : -0.05
      ),
      comeback_probability: 0.34,
      upset_probability: 0.29,
      draw_probability: 0,
      overtime_or_tiebreak_probability: 0.16,
      likely_next_major_event: "red_zone_play",
      expected_remaining_duration_minutes: Math.max(
        2,
        Math.round(quarterRemaining / 60)
      ),
      prediction_confidence: 0.78
    },
    summary: {
      headline: "The game is riding on the current possession",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore}.`,
      key_points: [
        "A single drive can flip the result",
        "Timeout leverage matters now",
        "Field position is sharply tilting the phase"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.8,
      warnings: []
    }
  };
};

const buildBaseballState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const inning = 7 + (minuteOffset % 2);
  const half = minuteOffset % 2 === 0 ? "top" : "bottom";
  const battingSide =
    half === "top"
      ? seed.identity.participants[1].participant_id
      : seed.identity.participants[0].participant_id;
  const isUnderReview = minuteOffset % 5 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: isUnderReview ? "paused" : "live",
    period: {
      code: `${half}_${inning}`,
      display: `${half === "top" ? "Top" : "Bottom"} ${inning}th`
    },
    clock: {
      display: `${half === "top" ? "Top" : "Bot"} ${inning}`,
      elapsed_seconds: inning * 600,
      remaining_seconds: Math.max(300, (9 - inning) * 600)
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      inning,
      innings_half: half,
      outs: minuteOffset % 3,
      balls: 2,
      strikes: 1,
      runners_on_base: minuteOffset % 2 === 0 ? ["first", "third"] : ["second"],
      possession_team: battingSide,
      attacking_side: battingSide
    },
    current_possession_or_control: {
      participant_id: battingSide,
      description: `${seed.identity.participants.find((participant) => participant.participant_id === battingSide)?.name} is at the plate with traffic on the bases`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "A late-inning scoring chance is building",
      summary:
        "Every pitch now has leverage because base traffic can break the deadlock or extend the margin.",
      situation_code: "late_inning_pressure",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "extra_base_hit",
      participant_id: battingSide,
      player_id: `${battingSide}-batter`,
      description: "A gap shot created immediate scoring pressure",
      match_time: `${half} ${inning}`,
      event_importance: 82
    },
    recent_events: [
      {
        description: "A patient at-bat pushed the starter out of rhythm",
        match_time: `${half} ${inning - 1}`
      }
    ],
    special_state: {
      is_timeout: false,
      is_under_review: isUnderReview,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: inning >= 9 && homeScore === awayScore,
      is_paused: isUnderReview,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isUnderReview ? "umpire review" : null,
      status_reason: isUnderReview
        ? "Play is paused while the umpire review is completed."
        : null
    },
    excitement: {
      aggregate_score: 81,
      level: "high",
      current_excitement: 83,
      recent_excitement: 78,
      expected_remaining_excitement: 82,
      reason_codes: ["runners_in_scoring_position", "late_innings"]
    },
    criticality: {
      score: 79,
      level: "high",
      reason_codes: ["late_innings", "bullpen_pressure"]
    },
    competitive_balance: {
      score: 84,
      level: "close"
    },
    watchability: buildWatchability({
      current_score: 72,
      tension_score: 61,
      scoring_imminence_score: 66,
      swing_potential_score: 69,
      state_clarity_score: 81,
      evidence_strength_score: 78
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 68,
      star_power_score: 66,
      upset_potential_score: 57,
      narrative_strength_score: 70
    }),
    momentum: {
      leading_participant_id: battingSide,
      score: 69,
      direction: "increasing",
      summary: "The batting side has stacked hard contact and baserunners",
      reason_codes: ["hard_contact", "runners_on_base"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        homeScore >= awayScore ? 0.55 : 0.45
      ),
      win_probability_changes: buildWinProbabilityChanges(
        seed,
        battingSide === seed.identity.participants[0].participant_id
          ? 0.04
          : -0.04
      ),
      comeback_probability: 0.3,
      upset_probability: 0.27,
      draw_probability: 0,
      overtime_or_tiebreak_probability: 0.11,
      likely_next_major_event: "run_scoring_hit",
      expected_remaining_duration_minutes: 28,
      prediction_confidence: 0.75
    },
    summary: {
      headline: "Late innings are amplifying every baserunner",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore}.`,
      key_points: [
        "Baserunners are shaping the inning",
        "Bullpen execution is under pressure",
        "One clean swing could decide the phase"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.77,
      warnings: []
    }
  };
};

const buildCricketState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const battingSide =
    minuteOffset % 2 === 0
      ? seed.identity.participants[0].participant_id
      : seed.identity.participants[1].participant_id;
  const over = 15.2 + minuteOffset * 0.2;
  const wickets = 4 + (minuteOffset % 3);
  const isWeatherDelay = minuteOffset % 7 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: isWeatherDelay ? "suspended" : "live",
    period: {
      code: "middle_overs",
      display: `Over ${over.toFixed(1)}`
    },
    clock: {
      display: `${over.toFixed(1)} ov`,
      elapsed_seconds: Math.round(over * 240),
      remaining_seconds: Math.max(240, Math.round((20 - over) * 240))
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      over,
      wickets,
      run_rate: 8.2 + minuteOffset * 0.1,
      target_runs: 176,
      power_play: over < 6,
      possession_team: battingSide,
      attacking_side: battingSide
    },
    current_possession_or_control: {
      participant_id: battingSide,
      description: `${seed.identity.participants.find((participant) => participant.participant_id === battingSide)?.name} is batting with the required tempo still within reach`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "The chase rate is putting the middle overs under pressure",
      summary:
        "Strike rotation and boundary access are both starting to matter more than pure wicket preservation.",
      situation_code: "chase_acceleration",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "boundary",
      participant_id: battingSide,
      player_id: `${battingSide}-set-batter`,
      description: "Back-to-back boundaries shifted the required equation",
      match_time: `${over.toFixed(1)} ov`,
      event_importance: 81
    },
    recent_events: [
      {
        description: "A misfield turned a single into three",
        match_time: `${Math.max(1, over - 0.4).toFixed(1)} ov`
      }
    ],
    special_state: {
      is_timeout: false,
      is_under_review: false,
      is_injury_delay: false,
      is_weather_delay: isWeatherDelay,
      is_overtime_or_tiebreak: false,
      is_paused: isWeatherDelay,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: isWeatherDelay,
      pause_reason: isWeatherDelay ? "weather delay" : null,
      status_reason: isWeatherDelay
        ? "Weather has temporarily suspended play."
        : null
    },
    excitement: {
      aggregate_score: 83,
      level: "high",
      current_excitement: 84,
      recent_excitement: 81,
      expected_remaining_excitement: 88,
      reason_codes: ["required_run_rate", "set_batter", "death_overs_ahead"]
    },
    criticality: {
      score: 82,
      level: "high",
      reason_codes: ["required_rate", "wickets_in_hand"]
    },
    competitive_balance: {
      score: 80,
      level: "close"
    },
    watchability: buildWatchability({
      current_score: 83,
      tension_score: 78,
      scoring_imminence_score: 79,
      swing_potential_score: 81,
      state_clarity_score: 77,
      evidence_strength_score: 76
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 69,
      star_power_score: 76,
      upset_potential_score: 60,
      narrative_strength_score: 74
    }),
    momentum: {
      leading_participant_id: battingSide,
      score: 73,
      direction: "increasing",
      summary: "The batting side has found a brief scoring surge",
      reason_codes: ["boundary_cluster", "strike_rotation"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        battingSide === seed.identity.participants[0].participant_id
          ? 0.54
          : 0.46
      ),
      win_probability_changes: buildWinProbabilityChanges(
        seed,
        battingSide === seed.identity.participants[0].participant_id
          ? 0.05
          : -0.05
      ),
      comeback_probability: 0.36,
      upset_probability: 0.26,
      draw_probability: 0,
      overtime_or_tiebreak_probability: 0,
      likely_next_major_event: "boundary_or_wicket",
      expected_remaining_duration_minutes: 22,
      prediction_confidence: 0.74
    },
    summary: {
      headline: "The chase still turns on boundary access and wickets",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore}.`,
      key_points: [
        "Run rate pressure is active",
        "Wickets in hand still matter",
        "A single over can reshape the chase"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.76,
      warnings: []
    }
  };
};

const buildHockeyState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const periodNumber = minuteOffset >= 6 ? 3 : 2;
  const remainingSeconds = Math.max(45, 1200 - minuteOffset * 120);
  const leader = leadingParticipantId(seed, homeScore, awayScore);
  const isUnderReview = minuteOffset % 4 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: isUnderReview ? "paused" : "live",
    period: {
      code: periodNumber === 3 ? "third_period" : "second_period",
      display: periodNumber === 3 ? "3rd Period" : "2nd Period"
    },
    clock: {
      display: `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
        remainingSeconds % 60
      ).padStart(2, "0")}`,
      elapsed_seconds: periodNumber * 1200 - remainingSeconds,
      remaining_seconds: remainingSeconds
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      period_number: periodNumber,
      phase:
        remainingSeconds < 180 ? "net_empty_watch" : "offensive_zone_cycle",
      pressure_side: seed.momentumParticipantId,
      attacking_side: seed.momentumParticipantId,
      pulled_goalie: remainingSeconds < 120 && homeScore < awayScore
    },
    current_possession_or_control: {
      participant_id: seed.momentumParticipantId,
      description:
        "One side is sustaining offensive-zone time and forcing repeated resets"
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "Sustained zone pressure is stretching the defensive structure",
      summary:
        "The shot volume is rising and line changes are becoming harder for the defending side.",
      situation_code: "zone_pressure",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "high_danger_chance",
      participant_id: leader,
      player_id: `${leader}-forward`,
      description: "A rebound sequence nearly broke the shape of the period",
      match_time: `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
        remainingSeconds % 60
      ).padStart(2, "0")}`,
      event_importance: 80
    },
    recent_events: [
      {
        description: "A point shot created a heavy-screen second chance",
        match_time: "07:41"
      }
    ],
    special_state: {
      is_timeout: false,
      is_under_review: isUnderReview,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false,
      is_paused: isUnderReview,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isUnderReview ? "goal review" : null,
      status_reason: isUnderReview
        ? "Officials are reviewing the previous sequence before play resumes."
        : null
    },
    excitement: {
      aggregate_score: 82,
      level: "high",
      current_excitement: 83,
      recent_excitement: 79,
      expected_remaining_excitement: 86,
      reason_codes: ["one_goal_margin", "sustained_pressure"]
    },
    criticality: {
      score: 81,
      level: "high",
      reason_codes: ["one_goal_margin", "third_period"]
    },
    competitive_balance: {
      score: 87,
      level: "close"
    },
    watchability: buildWatchability({
      current_score: 80,
      tension_score: 83,
      scoring_imminence_score: 77,
      swing_potential_score: 78,
      state_clarity_score: 79,
      evidence_strength_score: 78
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 65,
      star_power_score: 72,
      upset_potential_score: 52,
      narrative_strength_score: 71
    }),
    momentum: {
      leading_participant_id: seed.momentumParticipantId,
      score: 72,
      direction: "increasing",
      summary: "Zone time and shot pressure are tilting the ice",
      reason_codes: ["forecheck", "rebound_control"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        homeScore >= awayScore ? 0.56 : 0.44
      ),
      win_probability_changes: buildWinProbabilityChanges(seed, 0.04),
      comeback_probability: 0.31,
      upset_probability: 0.23,
      draw_probability: 0,
      overtime_or_tiebreak_probability:
        Math.abs(homeScore - awayScore) <= 1 ? 0.22 : 0.09,
      likely_next_major_event: "high_danger_chance",
      expected_remaining_duration_minutes: Math.max(
        2,
        Math.round(remainingSeconds / 60)
      ),
      prediction_confidence: 0.76
    },
    summary: {
      headline: "The next shift could decide the period",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore}.`,
      key_points: [
        "Zone time is becoming decisive",
        "The margin is still within one sequence",
        "Goalie pressure is increasing"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.78,
      warnings: []
    }
  };
};

const buildTennisState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const currentSet = minuteOffset >= 6 ? 3 : 2;
  const serveSide =
    minuteOffset % 2 === 0
      ? seed.identity.participants[0].participant_id
      : seed.identity.participants[1].participant_id;
  const isMedicalTimeout = minuteOffset % 6 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: isMedicalTimeout ? "paused" : "live",
    period: {
      code: `set_${currentSet}`,
      display: `Set ${currentSet}`
    },
    clock: {
      display: `${homeScore}-${awayScore}`,
      elapsed_seconds: currentSet * 1800,
      remaining_seconds: 900
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      current_set: currentSet,
      set_score: currentSet === 3 ? "6-4, 3-6" : "6-4",
      serve_side: serveSide,
      break_point_pressure: minuteOffset % 3 === 0,
      attacking_side: serveSide
    },
    current_possession_or_control: {
      participant_id: serveSide,
      description: `${seed.identity.participants.find((participant) => participant.participant_id === serveSide)?.name} is serving in a pressure game`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "A high-leverage service game is shaping the set",
      summary:
        "The current rally pattern is testing whether the server can hold under direct scoreboard pressure.",
      situation_code: "break_point_game",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "break_point_saved",
      participant_id: serveSide,
      player_id: serveSide,
      description: "A big first serve erased immediate break pressure",
      match_time: `Set ${currentSet}`,
      event_importance: 84
    },
    recent_events: [
      {
        description: "A long rally tilted the baseline exchange",
        match_time: `Set ${currentSet}`
      }
    ],
    special_state: {
      is_timeout: isMedicalTimeout,
      is_under_review: false,
      is_injury_delay: isMedicalTimeout,
      is_weather_delay: false,
      is_overtime_or_tiebreak: currentSet === 3 && homeScore === awayScore,
      is_paused: isMedicalTimeout,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isMedicalTimeout ? "medical timeout" : null,
      status_reason: isMedicalTimeout
        ? "Play is paused during a medical timeout."
        : null
    },
    excitement: {
      aggregate_score: 79,
      level: "high",
      current_excitement: 82,
      recent_excitement: 77,
      expected_remaining_excitement: 85,
      reason_codes: ["break_pressure", "deciding_set"]
    },
    criticality: {
      score: 83,
      level: "high",
      reason_codes: ["service_game", "set_leverage"]
    },
    competitive_balance: {
      score: 89,
      level: "very_close"
    },
    watchability: buildWatchability({
      current_score: 84,
      tension_score: 85,
      scoring_imminence_score: 74,
      swing_potential_score: 82,
      state_clarity_score: 80,
      evidence_strength_score: 79
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 83,
      star_power_score: 91,
      upset_potential_score: 50,
      narrative_strength_score: 84
    }),
    momentum: {
      leading_participant_id: serveSide,
      score: 68,
      direction: "volatile",
      summary: "Each service point is causing sharp swings in leverage",
      reason_codes: ["break_points", "long_rallies"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(seed, 0.51),
      win_probability_changes: buildWinProbabilityChanges(seed, 0.03),
      comeback_probability: 0.37,
      upset_probability: 0.21,
      draw_probability: 0,
      overtime_or_tiebreak_probability: 0.19,
      likely_next_major_event: "break_point",
      expected_remaining_duration_minutes: 18,
      prediction_confidence: 0.72
    },
    summary: {
      headline: "The next service game could decide the set",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore}.`,
      key_points: [
        "Service pressure is high",
        "Break points are near the surface",
        "Rally tolerance is shaping the edge"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.74,
      warnings: []
    }
  };
};

const buildMmaState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const round = minuteOffset >= 6 ? 4 : 3;
  const roundRemaining = Math.max(20, 300 - minuteOffset * 20);
  const aggressor =
    minuteOffset % 2 === 0
      ? seed.identity.participants[0].participant_id
      : seed.identity.participants[1].participant_id;
  const isInjuryDelay = minuteOffset % 8 === 0;

  return {
    match_id: seed.identity.match_id,
    match_status: isInjuryDelay ? "paused" : "live",
    period: {
      code: `round_${round}`,
      display: `Round ${round}`
    },
    clock: {
      display: `${String(Math.floor(roundRemaining / 60)).padStart(1, "0")}:${String(
        roundRemaining % 60
      ).padStart(2, "0")}`,
      elapsed_seconds: round * 300 - roundRemaining,
      remaining_seconds: roundRemaining
    },
    score: {
      participant_scores: buildParticipantScores(seed, homeScore, awayScore),
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      ...sportSpecificBase(),
      round,
      control_time_seconds: 48 + minuteOffset * 6,
      finish_threat:
        aggressor === seed.identity.participants[0].participant_id
          ? "home_pressure"
          : "away_pressure",
      attacking_side: aggressor
    },
    current_possession_or_control: {
      participant_id: aggressor,
      description: `${seed.identity.participants.find((participant) => participant.participant_id === aggressor)?.name} is forcing the higher-pressure exchanges`
    },
    active_players: buildActivePlayers(seed, seed.identity.sport, minuteOffset),
    what_is_happening: {
      headline: "The pace is stretching toward a potential finish window",
      summary:
        "Control time and cage pressure are starting to separate the round even if the fight remains competitive.",
      situation_code: "finish_window",
      key_entity_ids: seed.identity.participants.map(
        (participant: Participant) => participant.participant_id
      )
    },
    last_major_event: {
      event_id: `${seed.identity.match_id}-evt-${minuteOffset}`,
      event_type: "clean_combination",
      participant_id: aggressor,
      player_id: aggressor,
      description: "A clean combination forced a reset against the fence",
      match_time: `R${round} ${String(Math.floor(roundRemaining / 60))}:${String(
        roundRemaining % 60
      ).padStart(2, "0")}`,
      event_importance: 80
    },
    recent_events: [
      {
        description: "A scramble ended with top control for the aggressor",
        match_time: `R${round}`
      }
    ],
    special_state: {
      is_timeout: false,
      is_under_review: false,
      is_injury_delay: isInjuryDelay,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false,
      is_paused: isInjuryDelay,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: isInjuryDelay ? "cage-side medical check" : null,
      status_reason: isInjuryDelay
        ? "The referee has paused action for a quick medical check."
        : null
    },
    excitement: {
      aggregate_score: 78,
      level: "high",
      current_excitement: 81,
      recent_excitement: 76,
      expected_remaining_excitement: 83,
      reason_codes: ["finish_threat", "scramble_pace"]
    },
    criticality: {
      score: 77,
      level: "high",
      reason_codes: ["late_round", "damage_accumulation"]
    },
    competitive_balance: {
      score: 74,
      level: "competitive"
    },
    watchability: buildWatchability({
      current_score: 82,
      tension_score: 79,
      scoring_imminence_score: 88,
      swing_potential_score: 91,
      state_clarity_score: 76,
      evidence_strength_score: 75
    }),
    cross_phase_scores: buildCrossPhaseScores({
      stakes_score: 69,
      star_power_score: 86,
      upset_potential_score: 61,
      narrative_strength_score: 77
    }),
    momentum: {
      leading_participant_id: aggressor,
      score: 67,
      direction: "increasing",
      summary:
        "Forward pressure and top control are shaping the optics of the round",
      reason_codes: ["cage_pressure", "control_time"]
    },
    live_predictions: {
      win_probabilities: buildWinProbabilities(
        seed,
        aggressor === seed.identity.participants[0].participant_id ? 0.57 : 0.43
      ),
      win_probability_changes: buildWinProbabilityChanges(
        seed,
        aggressor === seed.identity.participants[0].participant_id
          ? 0.04
          : -0.04
      ),
      comeback_probability: 0.35,
      upset_probability: 0.22,
      draw_probability: 0.02,
      overtime_or_tiebreak_probability: 0,
      likely_next_major_event: "clean_entry_or_takedown",
      expected_remaining_duration_minutes: Math.max(
        1,
        Math.round(roundRemaining / 60)
      ),
      prediction_confidence: 0.73
    },
    summary: {
      headline: "The fight is still open but the pressure edge is visible",
      short_byte: `${seed.identity.participants[0].name} ${homeScore}, ${seed.identity.participants[1].name} ${awayScore} on the running scorecards.`,
      key_points: [
        "Control time is accumulating",
        "Damage optics still matter",
        "A finish threat remains live"
      ]
    },
    freshness: {
      generated_at: nowIso(),
      source_observation_time: null,
      age_seconds: 0
    },
    sources: [],
    verification: {
      status: "verified",
      confidence: 0.73,
      warnings: []
    }
  };
};

const buildState = (seed: MatchSeed, minuteOffset: number): LiveState => {
  const [homeBase, awayBase] = seed.scoreSeed;

  switch (seed.identity.sport) {
    case "soccer":
      return buildSoccerState(
        seed,
        minuteOffset,
        homeBase + (minuteOffset % 2),
        awayBase + ((minuteOffset + 1) % 2)
      );
    case "basketball":
      return buildBasketballState(
        seed,
        minuteOffset,
        homeBase + (minuteOffset % 7),
        awayBase + ((minuteOffset + 2) % 7)
      );
    case "american-football":
      return buildFootballState(
        seed,
        minuteOffset,
        homeBase + (minuteOffset % 2) * 3,
        awayBase + ((minuteOffset + 1) % 2) * 3
      );
    case "baseball":
      return buildBaseballState(
        seed,
        minuteOffset,
        homeBase + (minuteOffset % 2),
        awayBase + ((minuteOffset + 1) % 2)
      );
    case "cricket":
      return buildCricketState(
        seed,
        minuteOffset,
        homeBase + minuteOffset * 2,
        awayBase
      );
    case "hockey":
      return buildHockeyState(
        seed,
        minuteOffset,
        homeBase + (minuteOffset % 2),
        awayBase + ((minuteOffset + 1) % 2)
      );
    case "tennis":
      return buildTennisState(
        seed,
        minuteOffset,
        3 + (minuteOffset % 4),
        2 + ((minuteOffset + 1) % 4)
      );
    case "mma":
      return buildMmaState(
        seed,
        minuteOffset,
        29 + (minuteOffset % 2),
        28 + ((minuteOffset + 1) % 2)
      );
    default:
      return buildSoccerState(seed, minuteOffset, homeBase, awayBase);
  }
};

const seeds: MatchSeed[] = [
  {
    region: "north-america",
    identity: {
      match_id: "basketball:nba:2026-06-16:bos:gsw",
      sport: "basketball",
      tournament_name: "NBA",
      scheduled_start_time: "2026-06-16T19:00:00.000Z",
      participants: [
        { participant_id: "bos", name: "Boston Celtics", short_name: "BOS" },
        {
          participant_id: "gsw",
          name: "Golden State Warriors",
          short_name: "GSW"
        }
      ]
    },
    context: {
      match: {
        match_id: "basketball:nba:2026-06-16:bos:gsw",
        match_name: "Boston Celtics vs Golden State Warriors",
        sport: "basketball",
        tournament_name: "NBA",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T19:00:00.000Z",
        venue: {
          stadium: "Chase Center",
          city: "San Francisco",
          state: "California",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "bos",
          name: "Boston Celtics",
          short_name: "BOS",
          role: "away",
          ranking: "2",
          recent_form: ["W", "W", "L", "W", "W"]
        },
        {
          participant_id: "gsw",
          name: "Golden State Warriors",
          short_name: "GSW",
          role: "home",
          ranking: "5",
          recent_form: ["W", "L", "W", "W", "L"]
        }
      ],
      pre_match_intelligence: {
        headline: "Perimeter scoring duel shapes the matchup",
        summary:
          "The game projects as a close contest with late-game shotmaking likely to decide it.",
        expected_competitiveness: 87,
        key_matchup: "Boston wing defense versus Golden State spacing"
      },
      context_version: 1,
      context_fingerprint: "ctx_bos_gsw_v1",
      context_generated_at: "2026-06-16T18:45:00.000Z"
    },
    scoreSeed: [98, 97],
    momentumParticipantId: "gsw"
  },
  {
    region: "north-america",
    identity: {
      match_id: "soccer:mls:2026-06-16:lafc:sea",
      sport: "soccer",
      tournament_name: "MLS",
      scheduled_start_time: "2026-06-16T20:15:00.000Z",
      participants: [
        { participant_id: "lafc", name: "LAFC", short_name: "LAFC" },
        { participant_id: "sea", name: "Seattle Sounders", short_name: "SEA" }
      ]
    },
    context: {
      match: {
        match_id: "soccer:mls:2026-06-16:lafc:sea",
        match_name: "LAFC vs Seattle Sounders",
        sport: "soccer",
        tournament_name: "MLS",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T20:15:00.000Z",
        venue: {
          stadium: "BMO Stadium",
          city: "Los Angeles",
          state: "California",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "lafc",
          name: "LAFC",
          short_name: "LAFC",
          role: "home",
          ranking: "4",
          recent_form: ["W", "D", "W", "L", "W"]
        },
        {
          participant_id: "sea",
          name: "Seattle Sounders",
          short_name: "SEA",
          role: "away",
          ranking: "6",
          recent_form: ["W", "W", "D", "L", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Transition attacks could define this fixture",
        summary:
          "Both teams are capable of fast counters, which raises volatility in the second half.",
        expected_competitiveness: 81,
        key_matchup: "LAFC pressing against Seattle buildup"
      },
      context_version: 1,
      context_fingerprint: "ctx_lafc_sea_v1",
      context_generated_at: "2026-06-16T19:50:00.000Z"
    },
    scoreSeed: [1, 1],
    momentumParticipantId: "lafc"
  },
  {
    region: "north-america",
    identity: {
      match_id: "american-football:nfl:2026-06-16:kc:buf",
      sport: "american-football",
      tournament_name: "NFL",
      scheduled_start_time: "2026-06-16T18:25:00.000Z",
      participants: [
        {
          participant_id: "kc",
          name: "Kansas City Chiefs",
          short_name: "KC"
        },
        {
          participant_id: "buf",
          name: "Buffalo Bills",
          short_name: "BUF"
        }
      ]
    },
    context: {
      match: {
        match_id: "american-football:nfl:2026-06-16:kc:buf",
        match_name: "Kansas City Chiefs vs Buffalo Bills",
        sport: "american-football",
        tournament_name: "NFL",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T18:25:00.000Z",
        venue: {
          stadium: "Arrowhead Stadium",
          city: "Kansas City",
          state: "Missouri",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "kc",
          name: "Kansas City Chiefs",
          short_name: "KC",
          role: "home",
          ranking: "1",
          recent_form: ["W", "W", "W", "L", "W"]
        },
        {
          participant_id: "buf",
          name: "Buffalo Bills",
          short_name: "BUF",
          role: "away",
          ranking: "3",
          recent_form: ["W", "L", "W", "W", "W"]
        }
      ],
      pre_match_intelligence: {
        headline:
          "Quarterback efficiency and red-zone execution drive the edge",
        summary:
          "Both offenses can score quickly, but a late red-zone series could define the result.",
        expected_competitiveness: 88,
        key_matchup: "Chiefs route adjustments against Bills disguise coverages"
      },
      context_version: 1,
      context_fingerprint: "ctx_kc_buf_v1",
      context_generated_at: "2026-06-16T17:45:00.000Z"
    },
    scoreSeed: [24, 20],
    momentumParticipantId: "kc"
  },
  {
    region: "north-america",
    identity: {
      match_id: "baseball:mlb:2026-06-16:nyy:lad",
      sport: "baseball",
      tournament_name: "MLB",
      scheduled_start_time: "2026-06-16T17:10:00.000Z",
      participants: [
        { participant_id: "nyy", name: "New York Yankees", short_name: "NYY" },
        {
          participant_id: "lad",
          name: "Los Angeles Dodgers",
          short_name: "LAD"
        }
      ]
    },
    context: {
      match: {
        match_id: "baseball:mlb:2026-06-16:nyy:lad",
        match_name: "New York Yankees vs Los Angeles Dodgers",
        sport: "baseball",
        tournament_name: "MLB",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T17:10:00.000Z",
        venue: {
          stadium: "Yankee Stadium",
          city: "New York",
          state: "New York",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "nyy",
          name: "New York Yankees",
          short_name: "NYY",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "L", "W", "D"]
        },
        {
          participant_id: "lad",
          name: "Los Angeles Dodgers",
          short_name: "LAD",
          role: "away",
          ranking: "1",
          recent_form: ["W", "W", "W", "L", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Lineup depth versus contact management",
        summary:
          "Both offenses can punish mistakes, but bullpen sequencing may matter more late.",
        expected_competitiveness: 82,
        key_matchup: "Yankees right-handed power against Dodgers late relievers"
      },
      context_version: 1,
      context_fingerprint: "ctx_nyy_lad_v1",
      context_generated_at: "2026-06-16T16:35:00.000Z"
    },
    scoreSeed: [4, 3],
    momentumParticipantId: "lad"
  },
  {
    region: "north-america",
    identity: {
      match_id: "hockey:nhl:2026-06-16:nyr:edm",
      sport: "hockey",
      tournament_name: "NHL",
      scheduled_start_time: "2026-06-16T18:40:00.000Z",
      participants: [
        { participant_id: "nyr", name: "New York Rangers", short_name: "NYR" },
        { participant_id: "edm", name: "Edmonton Oilers", short_name: "EDM" }
      ]
    },
    context: {
      match: {
        match_id: "hockey:nhl:2026-06-16:nyr:edm",
        match_name: "New York Rangers vs Edmonton Oilers",
        sport: "hockey",
        tournament_name: "NHL",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T18:40:00.000Z",
        venue: {
          stadium: "Madison Square Garden",
          city: "New York",
          state: "New York",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "nyr",
          name: "New York Rangers",
          short_name: "NYR",
          role: "home",
          ranking: "4",
          recent_form: ["W", "W", "L", "W", "L"]
        },
        {
          participant_id: "edm",
          name: "Edmonton Oilers",
          short_name: "EDM",
          role: "away",
          ranking: "5",
          recent_form: ["W", "L", "W", "W", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Transition speed against defensive recovery",
        summary:
          "Both teams create dangerous chances off quick shifts in possession, which should keep the pace high.",
        expected_competitiveness: 80,
        key_matchup:
          "Rangers blue-line denial against Oilers controlled entries"
      },
      context_version: 1,
      context_fingerprint: "ctx_nyr_edm_v1",
      context_generated_at: "2026-06-16T17:50:00.000Z"
    },
    scoreSeed: [2, 2],
    momentumParticipantId: "edm"
  },
  {
    region: "north-america",
    identity: {
      match_id: "mma:ufc:2026-06-16:mak:edw",
      sport: "mma",
      tournament_name: "UFC",
      scheduled_start_time: "2026-06-16T21:00:00.000Z",
      participants: [
        {
          participant_id: "mak",
          name: "Islam Makhachev",
          short_name: "MAK"
        },
        {
          participant_id: "edw",
          name: "Leon Edwards",
          short_name: "EDW"
        }
      ]
    },
    context: {
      match: {
        match_id: "mma:ufc:2026-06-16:mak:edw",
        match_name: "Islam Makhachev vs Leon Edwards",
        sport: "mma",
        tournament_name: "UFC",
        tournament_stage: "Main Event",
        scheduled_start_time: "2026-06-16T21:00:00.000Z",
        venue: {
          stadium: "T-Mobile Arena",
          city: "Las Vegas",
          state: "Nevada",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "mak",
          name: "Islam Makhachev",
          short_name: "MAK",
          role: "home",
          ranking: "1",
          recent_form: ["W", "W", "W", "W", "W"]
        },
        {
          participant_id: "edw",
          name: "Leon Edwards",
          short_name: "EDW",
          role: "away",
          ranking: "2",
          recent_form: ["W", "W", "D", "W", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Control time versus range striking",
        summary:
          "The fight projects as tactical until one side can establish repeatable positioning advantages.",
        expected_competitiveness: 77,
        key_matchup: "Makhachev entries against Edwards' frame control"
      },
      context_version: 1,
      context_fingerprint: "ctx_mak_edw_v1",
      context_generated_at: "2026-06-16T20:15:00.000Z"
    },
    scoreSeed: [29, 28],
    momentumParticipantId: "mak"
  },
  {
    region: "europe",
    identity: {
      match_id: "soccer:epl:2026-06-16:ars:mci",
      sport: "soccer",
      tournament_name: "Premier League",
      scheduled_start_time: "2026-06-16T19:30:00.000Z",
      participants: [
        { participant_id: "ars", name: "Arsenal", short_name: "ARS" },
        { participant_id: "mci", name: "Manchester City", short_name: "MCI" }
      ]
    },
    context: {
      match: {
        match_id: "soccer:epl:2026-06-16:ars:mci",
        match_name: "Arsenal vs Manchester City",
        sport: "soccer",
        tournament_name: "Premier League",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T19:30:00.000Z",
        venue: {
          stadium: "Emirates Stadium",
          city: "London",
          state: "England",
          country: "United Kingdom"
        }
      },
      participants: [
        {
          participant_id: "ars",
          name: "Arsenal",
          short_name: "ARS",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "D", "W", "L"]
        },
        {
          participant_id: "mci",
          name: "Manchester City",
          short_name: "MCI",
          role: "away",
          ranking: "1",
          recent_form: ["W", "W", "W", "D", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Title-race pressure raises every possession",
        summary:
          "Both sides are comfortable controlling the ball, but field position swings could decide the final phase.",
        expected_competitiveness: 91,
        key_matchup: "Arsenal pressing triggers against City's buildup"
      },
      context_version: 1,
      context_fingerprint: "ctx_ars_mci_v1",
      context_generated_at: "2026-06-16T18:55:00.000Z"
    },
    scoreSeed: [2, 2],
    momentumParticipantId: "ars"
  },
  {
    region: "europe",
    identity: {
      match_id: "tennis:atp:2026-06-16:alc:sin",
      sport: "tennis",
      tournament_name: "ATP Tour",
      scheduled_start_time: "2026-06-16T14:00:00.000Z",
      participants: [
        { participant_id: "alc", name: "Carlos Alcaraz", short_name: "ALC" },
        { participant_id: "sin", name: "Jannik Sinner", short_name: "SIN" }
      ]
    },
    context: {
      match: {
        match_id: "tennis:atp:2026-06-16:alc:sin",
        match_name: "Carlos Alcaraz vs Jannik Sinner",
        sport: "tennis",
        tournament_name: "ATP Tour",
        tournament_stage: "Quarterfinal",
        scheduled_start_time: "2026-06-16T14:00:00.000Z",
        venue: {
          stadium: "Centre Court",
          city: "London",
          state: "England",
          country: "United Kingdom"
        }
      },
      participants: [
        {
          participant_id: "alc",
          name: "Carlos Alcaraz",
          short_name: "ALC",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "W", "L", "W"]
        },
        {
          participant_id: "sin",
          name: "Jannik Sinner",
          short_name: "SIN",
          role: "away",
          ranking: "1",
          recent_form: ["W", "W", "W", "W", "L"]
        }
      ],
      pre_match_intelligence: {
        headline: "Baseline pressure versus first-serve insulation",
        summary:
          "Both players can take control quickly, which makes service games unusually fragile.",
        expected_competitiveness: 89,
        key_matchup:
          "Alcaraz forehand pressure against Sinner early-strike timing"
      },
      context_version: 1,
      context_fingerprint: "ctx_alc_sin_v1",
      context_generated_at: "2026-06-16T13:10:00.000Z"
    },
    scoreSeed: [4, 3],
    momentumParticipantId: "alc"
  },
  {
    region: "latin-america",
    identity: {
      match_id: "soccer:libertadores:2026-06-16:fla:pal",
      sport: "soccer",
      tournament_name: "Copa Libertadores",
      scheduled_start_time: "2026-06-16T23:10:00.000Z",
      participants: [
        { participant_id: "fla", name: "Flamengo", short_name: "FLA" },
        { participant_id: "pal", name: "Palmeiras", short_name: "PAL" }
      ]
    },
    context: {
      match: {
        match_id: "soccer:libertadores:2026-06-16:fla:pal",
        match_name: "Flamengo vs Palmeiras",
        sport: "soccer",
        tournament_name: "Copa Libertadores",
        tournament_stage: "Knockout Round",
        scheduled_start_time: "2026-06-16T23:10:00.000Z",
        venue: {
          stadium: "Maracana",
          city: "Rio de Janeiro",
          state: "Rio de Janeiro",
          country: "Brazil"
        }
      },
      participants: [
        {
          participant_id: "fla",
          name: "Flamengo",
          short_name: "FLA",
          role: "home",
          ranking: "1",
          recent_form: ["W", "D", "W", "W", "W"]
        },
        {
          participant_id: "pal",
          name: "Palmeiras",
          short_name: "PAL",
          role: "away",
          ranking: "2",
          recent_form: ["W", "W", "L", "W", "D"]
        }
      ],
      pre_match_intelligence: {
        headline: "Knockout tension raises the floor of the contest",
        summary:
          "The match projects as aggressive and tactically compressed, with set pieces carrying unusual weight.",
        expected_competitiveness: 88,
        key_matchup: "Flamengo wide rotations against Palmeiras compact block"
      },
      context_version: 1,
      context_fingerprint: "ctx_fla_pal_v1",
      context_generated_at: "2026-06-16T22:35:00.000Z"
    },
    scoreSeed: [1, 0],
    momentumParticipantId: "pal"
  },
  {
    region: "asia-pacific",
    identity: {
      match_id: "basketball:nbl:2026-06-16:syd:mel",
      sport: "basketball",
      tournament_name: "NBL",
      scheduled_start_time: "2026-06-16T10:00:00.000Z",
      participants: [
        { participant_id: "syd", name: "Sydney Kings", short_name: "SYD" },
        { participant_id: "mel", name: "Melbourne United", short_name: "MEL" }
      ]
    },
    context: {
      match: {
        match_id: "basketball:nbl:2026-06-16:syd:mel",
        match_name: "Sydney Kings vs Melbourne United",
        sport: "basketball",
        tournament_name: "NBL",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-16T10:00:00.000Z",
        venue: {
          stadium: "Qudos Bank Arena",
          city: "Sydney",
          state: "New South Wales",
          country: "Australia"
        }
      },
      participants: [
        {
          participant_id: "syd",
          name: "Sydney Kings",
          short_name: "SYD",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "L", "W", "W"]
        },
        {
          participant_id: "mel",
          name: "Melbourne United",
          short_name: "MEL",
          role: "away",
          ranking: "3",
          recent_form: ["W", "L", "W", "W", "D"]
        }
      ],
      pre_match_intelligence: {
        headline: "Tempo control versus shot-making depth",
        summary:
          "This matchup profiles as a tactical tug-of-war with a strong chance of a late-possession finish.",
        expected_competitiveness: 83,
        key_matchup:
          "Sydney transition defense against Melbourne perimeter volume"
      },
      context_version: 1,
      context_fingerprint: "ctx_syd_mel_v1",
      context_generated_at: "2026-06-16T09:20:00.000Z"
    },
    scoreSeed: [87, 86],
    momentumParticipantId: "mel"
  },
  {
    region: "asia-pacific",
    identity: {
      match_id: "cricket:t20:2026-06-16:ind:aus",
      sport: "cricket",
      tournament_name: "T20 International",
      scheduled_start_time: "2026-06-16T11:30:00.000Z",
      participants: [
        { participant_id: "ind", name: "India", short_name: "IND" },
        { participant_id: "aus", name: "Australia", short_name: "AUS" }
      ]
    },
    context: {
      match: {
        match_id: "cricket:t20:2026-06-16:ind:aus",
        match_name: "India vs Australia",
        sport: "cricket",
        tournament_name: "T20 International",
        tournament_stage: "Series Match",
        scheduled_start_time: "2026-06-16T11:30:00.000Z",
        venue: {
          stadium: "Melbourne Cricket Ground",
          city: "Melbourne",
          state: "Victoria",
          country: "Australia"
        }
      },
      participants: [
        {
          participant_id: "ind",
          name: "India",
          short_name: "IND",
          role: "home",
          ranking: "1",
          recent_form: ["W", "W", "L", "W", "W"]
        },
        {
          participant_id: "aus",
          name: "Australia",
          short_name: "AUS",
          role: "away",
          ranking: "2",
          recent_form: ["W", "W", "W", "L", "W"]
        }
      ],
      pre_match_intelligence: {
        headline:
          "Powerplay efficiency and death-overs execution shape the matchup",
        summary:
          "The chase profile can swing quickly if boundary frequency changes across the final overs.",
        expected_competitiveness: 84,
        key_matchup:
          "India spin variations against Australia's middle-over hitters"
      },
      context_version: 1,
      context_fingerprint: "ctx_ind_aus_v1",
      context_generated_at: "2026-06-16T10:50:00.000Z"
    },
    scoreSeed: [142, 138],
    momentumParticipantId: "ind"
  }
];

const upcomingSeeds: UpcomingSeed[] = [
  {
    region: "north-america",
    match_id: "basketball:nba:2026-06-18:nyk:mil",
    context: {
      match: {
        match_id: "basketball:nba:2026-06-18:nyk:mil",
        match_name: "New York Knicks vs Milwaukee Bucks",
        sport: "basketball",
        tournament_name: "NBA",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-18T23:30:00.000Z",
        venue: {
          stadium: "Madison Square Garden",
          city: "New York",
          state: "New York",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "nyk",
          name: "New York Knicks",
          short_name: "NYK",
          role: "home",
          ranking: "3",
          recent_form: ["W", "W", "L", "W", "W"]
        },
        {
          participant_id: "mil",
          name: "Milwaukee Bucks",
          short_name: "MIL",
          role: "away",
          ranking: "4",
          recent_form: ["W", "L", "W", "W", "L"]
        }
      ],
      pre_match_intelligence: {
        headline: "Interior pressure versus half-court discipline",
        summary:
          "Both teams project as playoff-level opponents with late-possession execution likely to matter.",
        expected_competitiveness: 84,
        key_matchup: "Knicks rebounding against Bucks transition scoring"
      },
      context_version: 1,
      context_fingerprint: "ctx_nyk_mil_v1",
      context_generated_at: "2026-06-16T20:30:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A likely playoff-preview level contest",
      summary:
        "This game projects as one of the strongest upcoming basketball matchups in the current window.",
      projected_competitiveness: 84,
      watch_reasons: [
        "Both teams are in strong recent form",
        "The matchup has seeding implications",
        "Late-game creation should be tested"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 82,
        star_power_score: 78,
        upset_potential_score: 58,
        narrative_strength_score: 81
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 84,
        stakes_score: 82,
        star_power_score: 78,
        volatility_score: 73,
        upset_potential_score: 58,
        narrative_strength_score: 81
      }),
      win_probabilities: [
        { participant_id: "nyk", probability: 0.52 },
        { participant_id: "mil", probability: 0.48 }
      ]
    })
  },
  {
    region: "north-america",
    match_id: "soccer:mls:2026-06-19:mia:atl",
    context: {
      match: {
        match_id: "soccer:mls:2026-06-19:mia:atl",
        match_name: "Inter Miami vs Atlanta United",
        sport: "soccer",
        tournament_name: "MLS",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-19T01:00:00.000Z",
        venue: {
          stadium: "Chase Stadium",
          city: "Fort Lauderdale",
          state: "Florida",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "mia",
          name: "Inter Miami",
          short_name: "MIA",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "D", "W", "L"]
        },
        {
          participant_id: "atl",
          name: "Atlanta United",
          short_name: "ATL",
          role: "away",
          ranking: "7",
          recent_form: ["D", "W", "L", "W", "D"]
        }
      ],
      pre_match_intelligence: {
        headline: "Chance creation should be high on both sides",
        summary:
          "The fixture leans open, with both sides comfortable attacking central spaces quickly.",
        expected_competitiveness: 79,
        key_matchup: "Miami attacking width against Atlanta recovery defending"
      },
      context_version: 1,
      context_fingerprint: "ctx_mia_atl_v1",
      context_generated_at: "2026-06-16T21:00:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "One of the more volatile MLS fixtures this week",
      summary:
        "The game profiles as high-event, with strong watchability even if prediction confidence is moderate.",
      projected_competitiveness: 79,
      watch_reasons: [
        "High attacking volatility",
        "Potential playoff positioning impact",
        "Open tactical matchup"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 71,
        star_power_score: 79,
        upset_potential_score: 63,
        narrative_strength_score: 78
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 82,
        stakes_score: 71,
        star_power_score: 79,
        volatility_score: 86,
        upset_potential_score: 63,
        narrative_strength_score: 78
      }),
      win_probabilities: [
        { participant_id: "mia", probability: 0.55 },
        { participant_id: "atl", probability: 0.45 }
      ]
    })
  },
  {
    region: "north-america",
    match_id: "american-football:nfl:2026-06-20:phi:bal",
    context: {
      match: {
        match_id: "american-football:nfl:2026-06-20:phi:bal",
        match_name: "Philadelphia Eagles vs Baltimore Ravens",
        sport: "american-football",
        tournament_name: "NFL",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-20T20:25:00.000Z",
        venue: {
          stadium: "Lincoln Financial Field",
          city: "Philadelphia",
          state: "Pennsylvania",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "phi",
          name: "Philadelphia Eagles",
          short_name: "PHI",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "W", "L", "W"]
        },
        {
          participant_id: "bal",
          name: "Baltimore Ravens",
          short_name: "BAL",
          role: "away",
          ranking: "3",
          recent_form: ["W", "L", "W", "W", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Explosive rushing design versus disguise-heavy defense",
        summary:
          "This matchup could flip on third-down efficiency and red-zone sequence quality.",
        expected_competitiveness: 86,
        key_matchup: "Eagles RPO pressure against Ravens linebacker timing"
      },
      context_version: 1,
      context_fingerprint: "ctx_phi_bal_v1",
      context_generated_at: "2026-06-16T20:05:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A premium NFL chess match in the coming window",
      summary:
        "Both teams bring top-tier structure, which raises the chance of a late one-possession finish.",
      projected_competitiveness: 86,
      watch_reasons: [
        "High-end quarterback and run-game stress",
        "Strong defensive adjustment potential",
        "Likely one-possession script"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 84,
        star_power_score: 87,
        upset_potential_score: 54,
        narrative_strength_score: 85
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 88,
        stakes_score: 84,
        star_power_score: 87,
        volatility_score: 72,
        upset_potential_score: 54,
        narrative_strength_score: 85
      }),
      win_probabilities: [
        { participant_id: "phi", probability: 0.51 },
        { participant_id: "bal", probability: 0.49 }
      ]
    })
  },
  {
    region: "north-america",
    match_id: "baseball:mlb:2026-06-19:hou:sea",
    context: {
      match: {
        match_id: "baseball:mlb:2026-06-19:hou:sea",
        match_name: "Houston Astros vs Seattle Mariners",
        sport: "baseball",
        tournament_name: "MLB",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-19T23:10:00.000Z",
        venue: {
          stadium: "Minute Maid Park",
          city: "Houston",
          state: "Texas",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "hou",
          name: "Houston Astros",
          short_name: "HOU",
          role: "home",
          ranking: "4",
          recent_form: ["W", "L", "W", "W", "W"]
        },
        {
          participant_id: "sea2",
          name: "Seattle Mariners",
          short_name: "SEA",
          role: "away",
          ranking: "5",
          recent_form: ["W", "W", "L", "W", "L"]
        }
      ],
      pre_match_intelligence: {
        headline: "Pitch-sequencing precision should define the margin",
        summary:
          "Neither lineup gives away many at-bats, so late leverage spots could decide the game.",
        expected_competitiveness: 78,
        key_matchup: "Astros lefty bat path against Mariners bullpen shapes"
      },
      context_version: 1,
      context_fingerprint: "ctx_hou_sea_v1",
      context_generated_at: "2026-06-16T19:40:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A layered pitching-and-contact matchup",
      summary:
        "The game projects as close because both clubs can extend at-bats and pressure middle innings.",
      projected_competitiveness: 78,
      watch_reasons: [
        "Bullpen sequencing matters",
        "Both lineups can manufacture leverage",
        "Expected narrow run margin"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 68,
        star_power_score: 66,
        upset_potential_score: 57,
        narrative_strength_score: 70
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 74,
        stakes_score: 68,
        star_power_score: 66,
        volatility_score: 59,
        upset_potential_score: 57,
        narrative_strength_score: 70
      }),
      win_probabilities: [
        { participant_id: "hou", probability: 0.53 },
        { participant_id: "sea2", probability: 0.47 }
      ]
    })
  },
  {
    region: "north-america",
    match_id: "hockey:nhl:2026-06-19:tor:vgk",
    context: {
      match: {
        match_id: "hockey:nhl:2026-06-19:tor:vgk",
        match_name: "Toronto Maple Leafs vs Vegas Golden Knights",
        sport: "hockey",
        tournament_name: "NHL",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-19T23:30:00.000Z",
        venue: {
          stadium: "Scotiabank Arena",
          city: "Toronto",
          state: "Ontario",
          country: "Canada"
        }
      },
      participants: [
        {
          participant_id: "tor",
          name: "Toronto Maple Leafs",
          short_name: "TOR",
          role: "home",
          ranking: "6",
          recent_form: ["W", "W", "L", "D", "W"]
        },
        {
          participant_id: "vgk",
          name: "Vegas Golden Knights",
          short_name: "VGK",
          role: "away",
          ranking: "4",
          recent_form: ["W", "L", "W", "W", "L"]
        }
      ],
      pre_match_intelligence: {
        headline: "Rush attack versus controlled zone-entry defense",
        summary:
          "Expect momentum swings driven by transition chances and power-play discipline.",
        expected_competitiveness: 79,
        key_matchup:
          "Toronto speed through neutral ice against Vegas gap control"
      },
      context_version: 1,
      context_fingerprint: "ctx_tor_vgk_v1",
      context_generated_at: "2026-06-16T18:15:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A strong cross-conference hockey matchup",
      summary:
        "The pace and transition quality suggest a game that stays tactically alive throughout.",
      projected_competitiveness: 79,
      watch_reasons: [
        "High transition threat",
        "Special teams could swing the margin",
        "Even-strength play is closely matched"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 65,
        star_power_score: 72,
        upset_potential_score: 52,
        narrative_strength_score: 71
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 76,
        stakes_score: 65,
        star_power_score: 72,
        volatility_score: 69,
        upset_potential_score: 52,
        narrative_strength_score: 71
      }),
      win_probabilities: [
        { participant_id: "tor", probability: 0.5 },
        { participant_id: "vgk", probability: 0.5 }
      ]
    })
  },
  {
    region: "north-america",
    match_id: "mma:ufc:2026-06-21:per:whi",
    context: {
      match: {
        match_id: "mma:ufc:2026-06-21:per:whi",
        match_name: "Alex Pereira vs Robert Whittaker",
        sport: "mma",
        tournament_name: "UFC",
        tournament_stage: "Co-Main Event",
        scheduled_start_time: "2026-06-21T03:00:00.000Z",
        venue: {
          stadium: "Crypto.com Arena",
          city: "Los Angeles",
          state: "California",
          country: "United States"
        }
      },
      participants: [
        {
          participant_id: "per",
          name: "Alex Pereira",
          short_name: "PER",
          role: "home",
          ranking: "1",
          recent_form: ["W", "W", "W", "L", "W"]
        },
        {
          participant_id: "whi",
          name: "Robert Whittaker",
          short_name: "WHI",
          role: "away",
          ranking: "3",
          recent_form: ["W", "W", "L", "W", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Kickboxing danger against layered movement",
        summary:
          "The fight should stay tactically dense until one side establishes a repeatable rhythm.",
        expected_competitiveness: 75,
        key_matchup: "Pereira range traps against Whittaker entries"
      },
      context_version: 1,
      context_fingerprint: "ctx_per_whi_v1",
      context_generated_at: "2026-06-16T19:55:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A striking-heavy UFC matchup with real finish upside",
      summary:
        "The matchup carries strong watchability because one clean sequence could reset the whole read.",
      projected_competitiveness: 75,
      watch_reasons: [
        "High finish threat",
        "Elite range management battle",
        "Momentum can flip instantly"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 69,
        star_power_score: 86,
        upset_potential_score: 61,
        narrative_strength_score: 77
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 81,
        stakes_score: 69,
        star_power_score: 86,
        volatility_score: 88,
        upset_potential_score: 61,
        narrative_strength_score: 77
      }),
      win_probabilities: [
        { participant_id: "per", probability: 0.56 },
        { participant_id: "whi", probability: 0.44 }
      ]
    })
  },
  {
    region: "europe",
    match_id: "soccer:serie-a:2026-06-18:int:nap",
    context: {
      match: {
        match_id: "soccer:serie-a:2026-06-18:int:nap",
        match_name: "Inter Milan vs Napoli",
        sport: "soccer",
        tournament_name: "Serie A",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-19T18:45:00.000Z",
        venue: {
          stadium: "San Siro",
          city: "Milan",
          state: "Lombardy",
          country: "Italy"
        }
      },
      participants: [
        {
          participant_id: "int",
          name: "Inter Milan",
          short_name: "INT",
          role: "home",
          ranking: "1",
          recent_form: ["W", "W", "D", "W", "W"]
        },
        {
          participant_id: "nap",
          name: "Napoli",
          short_name: "NAP",
          role: "away",
          ranking: "3",
          recent_form: ["W", "L", "W", "W", "D"]
        }
      ],
      pre_match_intelligence: {
        headline: "A heavyweight technical battle with title implications",
        summary:
          "The game should feature long settled possessions and a premium on exploiting narrow passing windows.",
        expected_competitiveness: 86,
        key_matchup: "Inter wing-backs against Napoli half-space runners"
      },
      context_version: 1,
      context_fingerprint: "ctx_int_nap_v1",
      context_generated_at: "2026-06-16T16:20:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline:
        "One of the strongest European club fixtures in the current window",
      summary:
        "This is a high-leverage matchup with strong technical quality and a good chance of late tactical adjustments deciding it.",
      projected_competitiveness: 86,
      watch_reasons: [
        "Title race implications",
        "High technical quality in midfield",
        "Likely narrow margin"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 90,
        star_power_score: 84,
        upset_potential_score: 48,
        narrative_strength_score: 88
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 87,
        stakes_score: 90,
        star_power_score: 84,
        volatility_score: 66,
        upset_potential_score: 48,
        narrative_strength_score: 88
      }),
      win_probabilities: [
        { participant_id: "int", probability: 0.54 },
        { participant_id: "nap", probability: 0.46 }
      ]
    })
  },
  {
    region: "europe",
    match_id: "tennis:wta:2026-06-18:sab:iga",
    context: {
      match: {
        match_id: "tennis:wta:2026-06-18:sab:iga",
        match_name: "Aryna Sabalenka vs Iga Swiatek",
        sport: "tennis",
        tournament_name: "WTA Tour",
        tournament_stage: "Semifinal",
        scheduled_start_time: "2026-06-19T14:30:00.000Z",
        venue: {
          stadium: "Court Philippe-Chatrier",
          city: "Paris",
          state: "Ile-de-France",
          country: "France"
        }
      },
      participants: [
        {
          participant_id: "sab",
          name: "Aryna Sabalenka",
          short_name: "SAB",
          role: "home",
          ranking: "2",
          recent_form: ["W", "W", "W", "L", "W"]
        },
        {
          participant_id: "iga",
          name: "Iga Swiatek",
          short_name: "IGA",
          role: "away",
          ranking: "1",
          recent_form: ["W", "W", "W", "W", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Power first-strike tennis meets elastic court defense",
        summary:
          "The matchup stays compelling because hold pressure can spike quickly in long deuce games.",
        expected_competitiveness: 88,
        key_matchup: "Sabalenka serve-plus-one against Swiatek return depth"
      },
      context_version: 1,
      context_fingerprint: "ctx_sab_iga_v1",
      context_generated_at: "2026-06-16T15:05:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "One of the strongest tennis fixtures in the window",
      summary:
        "This matchup should stay tense because both players can turn small return edges into set pressure.",
      projected_competitiveness: 88,
      watch_reasons: [
        "Elite baseline quality",
        "Break-point leverage should be constant",
        "Very narrow projected margin"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 83,
        star_power_score: 91,
        upset_potential_score: 50,
        narrative_strength_score: 84
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 85,
        stakes_score: 83,
        star_power_score: 91,
        volatility_score: 72,
        upset_potential_score: 50,
        narrative_strength_score: 84
      }),
      win_probabilities: [
        { participant_id: "sab", probability: 0.48 },
        { participant_id: "iga", probability: 0.52 }
      ]
    })
  },
  {
    region: "latin-america",
    match_id: "soccer:brasileirao:2026-06-18:cor:flu",
    context: {
      match: {
        match_id: "soccer:brasileirao:2026-06-18:cor:flu",
        match_name: "Corinthians vs Fluminense",
        sport: "soccer",
        tournament_name: "Brasileirao",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-18T23:00:00.000Z",
        venue: {
          stadium: "Neo Quimica Arena",
          city: "Sao Paulo",
          state: "Sao Paulo",
          country: "Brazil"
        }
      },
      participants: [
        {
          participant_id: "cor",
          name: "Corinthians",
          short_name: "COR",
          role: "home",
          ranking: "6",
          recent_form: ["W", "D", "W", "L", "W"]
        },
        {
          participant_id: "flu",
          name: "Fluminense",
          short_name: "FLU",
          role: "away",
          ranking: "5",
          recent_form: ["W", "W", "L", "D", "W"]
        }
      ],
      pre_match_intelligence: {
        headline: "Control versus improvisation should define the rhythm",
        summary:
          "Both teams can create in bursts, but defensive shape may determine whether the game opens up late.",
        expected_competitiveness: 78,
        key_matchup: "Corinthians midfield screen against Fluminense rotations"
      },
      context_version: 1,
      context_fingerprint: "ctx_cor_flu_v1",
      context_generated_at: "2026-06-16T21:10:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline:
        "A volatile South American league matchup with tactical contrast",
      summary:
        "The fixture projects as uneven in rhythm but high in watchability, especially if the game state opens up after halftime.",
      projected_competitiveness: 78,
      watch_reasons: [
        "Tactical contrast",
        "Strong counterattacking potential",
        "Likely momentum swings"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 67,
        star_power_score: 70,
        upset_potential_score: 59,
        narrative_strength_score: 75
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 77,
        stakes_score: 67,
        star_power_score: 70,
        volatility_score: 82,
        upset_potential_score: 59,
        narrative_strength_score: 75
      }),
      win_probabilities: [
        { participant_id: "cor", probability: 0.5 },
        { participant_id: "flu", probability: 0.5 }
      ]
    })
  },
  {
    region: "asia-pacific",
    match_id: "basketball:b-league:2026-06-18:tok:osa",
    context: {
      match: {
        match_id: "basketball:b-league:2026-06-18:tok:osa",
        match_name: "Tokyo Alvark vs Osaka Evessa",
        sport: "basketball",
        tournament_name: "B.League",
        tournament_stage: "Regular Season",
        scheduled_start_time: "2026-06-19T10:05:00.000Z",
        venue: {
          stadium: "Yoyogi National Gymnasium",
          city: "Tokyo",
          state: "Tokyo",
          country: "Japan"
        }
      },
      participants: [
        {
          participant_id: "tok",
          name: "Tokyo Alvark",
          short_name: "TOK",
          role: "home",
          ranking: "1",
          recent_form: ["W", "W", "W", "L", "W"]
        },
        {
          participant_id: "osa",
          name: "Osaka Evessa",
          short_name: "OSA",
          role: "away",
          ranking: "4",
          recent_form: ["W", "D", "W", "W", "L"]
        }
      ],
      pre_match_intelligence: {
        headline: "Efficiency battle between structured offenses",
        summary:
          "The game should reward half-court execution, with turnovers and rebounding margin likely to shape the outcome.",
        expected_competitiveness: 80,
        key_matchup: "Tokyo paint control against Osaka perimeter shot quality"
      },
      context_version: 1,
      context_fingerprint: "ctx_tok_osa_v1",
      context_generated_at: "2026-06-16T08:30:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A strong Asia-Pacific basketball fixture with playoff energy",
      summary:
        "Both teams project well in structured offense, which raises the chance of a close late-game finish.",
      projected_competitiveness: 80,
      watch_reasons: [
        "Playoff-caliber shotmaking",
        "Tight rebounding battle",
        "Late-game execution test"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 74,
        star_power_score: 68,
        upset_potential_score: 55,
        narrative_strength_score: 73
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 78,
        stakes_score: 74,
        star_power_score: 68,
        volatility_score: 70,
        upset_potential_score: 55,
        narrative_strength_score: 73
      }),
      win_probabilities: [
        { participant_id: "tok", probability: 0.57 },
        { participant_id: "osa", probability: 0.43 }
      ]
    })
  },
  {
    region: "asia-pacific",
    match_id: "cricket:t20:2026-06-18:pak:nz",
    context: {
      match: {
        match_id: "cricket:t20:2026-06-18:pak:nz",
        match_name: "Pakistan vs New Zealand",
        sport: "cricket",
        tournament_name: "T20 International",
        tournament_stage: "Series Match",
        scheduled_start_time: "2026-06-19T09:30:00.000Z",
        venue: {
          stadium: "Gaddafi Stadium",
          city: "Lahore",
          state: "Punjab",
          country: "Pakistan"
        }
      },
      participants: [
        {
          participant_id: "pak",
          name: "Pakistan",
          short_name: "PAK",
          role: "home",
          ranking: "4",
          recent_form: ["W", "L", "W", "W", "W"]
        },
        {
          participant_id: "nz",
          name: "New Zealand",
          short_name: "NZ",
          role: "away",
          ranking: "5",
          recent_form: ["W", "W", "L", "W", "D"]
        }
      ],
      pre_match_intelligence: {
        headline: "Powerplay control may decide the chase shape",
        summary:
          "This matchup should stay open because both teams can compress the required rate quickly.",
        expected_competitiveness: 81,
        key_matchup:
          "Pakistan new-ball movement against New Zealand top-order tempo"
      },
      context_version: 1,
      context_fingerprint: "ctx_pak_nz_v1",
      context_generated_at: "2026-06-16T07:50:00.000Z"
    },
    upcoming_intelligence: buildUpcomingIntelligence({
      headline: "A compelling T20 matchup with chase volatility",
      summary:
        "The match projects as tightly balanced because both sides can accelerate sharply through the middle overs.",
      projected_competitiveness: 81,
      watch_reasons: [
        "Powerplay leverage",
        "Boundary-hitting depth",
        "Volatile chase profile"
      ],
      cross_phase_scores: buildCrossPhaseScores({
        stakes_score: 69,
        star_power_score: 76,
        upset_potential_score: 60,
        narrative_strength_score: 74
      }),
      audience_signals: buildAudienceSignals({
        audience_interest_score: 80,
        stakes_score: 69,
        star_power_score: 76,
        volatility_score: 88,
        upset_potential_score: 60,
        narrative_strength_score: 74
      }),
      win_probabilities: [
        { participant_id: "pak", probability: 0.51 },
        { participant_id: "nz", probability: 0.49 }
      ]
    })
  }
];

export const listSeedIdentities = (): MatchIdentity[] =>
  seeds.map((seed) => seed.identity);

export const discoverMockEvents = (
  knownFingerprints: Map<string, string>,
  includeContext: boolean,
  sport: string,
  region: string
): LiveEvent[] => {
  const minuteOffset = Math.floor(Date.now() / 60000) % 12;
  return seeds
    .filter((seed) => matchesRegion(seed.region, region))
    .filter((seed) => sport === "all" || seed.identity.sport === sport)
    .map((seed) => {
      const state = buildState(seed, minuteOffset);
      const knownFingerprint = knownFingerprints.get(seed.identity.match_id);
      const contextStatus =
        knownFingerprint === seed.context.context_fingerprint
          ? "unchanged"
          : knownFingerprint
            ? "updated"
            : "new";

      return {
        match_id: seed.identity.match_id,
        context_status: contextStatus,
        context_fingerprint: seed.context.context_fingerprint,
        context:
          includeContext && contextStatus !== "unchanged" ? seed.context : null,
        live_state: state,
        freshness: {
          context_generated_at: seed.context.context_generated_at,
          state_generated_at: state.freshness.generated_at,
          context_age_seconds: Math.floor(
            (Date.now() -
              new Date(seed.context.context_generated_at).getTime()) /
              1000
          ),
          state_age_seconds: state.freshness.age_seconds
        }
      };
    });
};

export const refreshMockStates = (matches: MatchIdentity[]): LiveState[] => {
  const minuteOffset = Math.floor(Date.now() / 60000) % 12;
  return matches
    .map((identity) =>
      seeds.find((seed) => seed.identity.match_id === identity.match_id)
    )
    .filter((seed): seed is MatchSeed => Boolean(seed))
    .map((seed) => buildState(seed, minuteOffset));
};

export const findMockLiveEvent = (matchId: string): LiveEvent | null => {
  const seed = seeds.find(
    (candidate) => candidate.identity.match_id === matchId
  );
  if (!seed) {
    return null;
  }

  const state = buildState(seed, Math.floor(Date.now() / 60000) % 12);
  return {
    match_id: seed.identity.match_id,
    context_status: "new",
    context_fingerprint: seed.context.context_fingerprint,
    context: seed.context,
    live_state: state,
    freshness: {
      context_generated_at: seed.context.context_generated_at,
      state_generated_at: state.freshness.generated_at,
      context_age_seconds: Math.floor(
        (Date.now() - new Date(seed.context.context_generated_at).getTime()) /
          1000
      ),
      state_age_seconds: state.freshness.age_seconds
    }
  };
};

export const findMockContext = (matchId: string): MatchContext | null =>
  seeds.find((seed) => seed.identity.match_id === matchId)?.context ?? null;

export const findMockState = (matchId: string): LiveState | null => {
  const seed = seeds.find(
    (candidate) => candidate.identity.match_id === matchId
  );
  if (!seed) {
    return null;
  }

  return buildState(seed, Math.floor(Date.now() / 60000) % 12);
};

export const listMockUpcomingEvents = (
  region: string,
  sport: string,
  days: number
): UpcomingEvent[] => {
  const now = Date.now();
  const maxTime = now + days * 24 * 60 * 60 * 1000;

  return upcomingSeeds
    .filter((seed) => matchesRegion(seed.region, region))
    .filter((seed) => sport === "all" || seed.context.match.sport === sport)
    .filter((seed) => {
      const scheduledTime = new Date(
        seed.context.match.scheduled_start_time
      ).getTime();
      return scheduledTime >= now && scheduledTime <= maxTime;
    })
    .map((seed) => ({
      match_id: seed.match_id,
      context: seed.context,
      upcoming_intelligence: seed.upcoming_intelligence,
      freshness: {
        generated_at: nowIso(),
        age_seconds: 0
      }
    }));
};

export const findMockUpcomingEvent = (
  matchId: string
): UpcomingEvent | null => {
  const seed = upcomingSeeds.find(
    (candidate) => candidate.match_id === matchId
  );
  if (!seed) {
    return null;
  }

  return {
    match_id: seed.match_id,
    context: seed.context,
    upcoming_intelligence: seed.upcoming_intelligence,
    freshness: {
      generated_at: nowIso(),
      age_seconds: 0
    }
  };
};
