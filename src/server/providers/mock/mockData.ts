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

const nowIso = (): string => new Date().toISOString();

const matchesRegion = (seedRegion: string, requestedRegion: string): boolean =>
  requestedRegion === "global" || seedRegion === requestedRegion;

const buildBasketballState = (
  seed: MatchSeed,
  minuteOffset: number,
  homeScore: number,
  awayScore: number
): LiveState => {
  const remainingSeconds = Math.max(24, 720 - minuteOffset * 11);
  const leader =
    homeScore >= awayScore
      ? seed.identity.participants[0].participant_id
      : seed.identity.participants[1].participant_id;

  return {
    match_id: seed.identity.match_id,
    match_status: remainingSeconds <= 30 ? "completed" : "live",
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
      participant_scores: [
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
      ],
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      quarter: remainingSeconds <= 180 ? 4 : 3,
      shot_clock_seconds: Math.max(2, 24 - (minuteOffset % 20)),
      foul_pressure:
        homeScore >= awayScore ? "away_bonus_watch" : "home_bonus_watch"
    },
    current_possession_or_control: {
      participant_id: seed.momentumParticipantId,
      description:
        leader === seed.identity.participants[0].participant_id
          ? `${seed.identity.participants[0].name} is bringing the ball up in a half-court set`
          : `${seed.identity.participants[1].name} controls the possession after the latest score`
    },
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
      is_timeout: remainingSeconds < 120 && minuteOffset % 3 === 0,
      is_under_review: false,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false
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
    momentum: {
      leading_participant_id: seed.momentumParticipantId,
      score: 76,
      direction: "increasing",
      summary: "One team is sustaining pressure across several possessions",
      reason_codes: ["shot_quality_edge", "back_to_back_scores"]
    },
    live_predictions: {
      win_probabilities: [
        {
          participant_id: seed.identity.participants[0].participant_id,
          probability: homeScore >= awayScore ? 0.57 : 0.43
        },
        {
          participant_id: seed.identity.participants[1].participant_id,
          probability: homeScore >= awayScore ? 0.43 : 0.57
        }
      ],
      win_probability_changes: [
        {
          participant_id: seed.identity.participants[0].participant_id,
          last_interval: homeScore >= awayScore ? 0.06 : -0.06
        },
        {
          participant_id: seed.identity.participants[1].participant_id,
          last_interval: homeScore >= awayScore ? -0.06 : 0.06
        }
      ],
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
  const leader =
    homeScore >= awayScore
      ? seed.identity.participants[0].participant_id
      : seed.identity.participants[1].participant_id;
  const isLevel = homeScore === awayScore;

  return {
    match_id: seed.identity.match_id,
    match_status: elapsedMinutes >= 89 ? "completed" : "live",
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
      participant_scores: [
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
      ],
      display: `${homeScore}-${awayScore}`,
      score_differential: Math.abs(homeScore - awayScore)
    },
    sport_specific: {
      phase:
        elapsedMinutes >= 45 ? "open_second_half" : "controlled_first_half",
      stoppage_time_minutes: elapsedMinutes >= 88 ? 4 : 0,
      pressure_side: seed.momentumParticipantId
    },
    current_possession_or_control: {
      participant_id: seed.momentumParticipantId,
      description:
        seed.momentumParticipantId ===
        seed.identity.participants[0].participant_id
          ? `${seed.identity.participants[0].name} is holding territory in the attacking half`
          : `${seed.identity.participants[1].name} is circulating possession and forcing deeper defending`
    },
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
      event_type: "score",
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
      is_under_review: elapsedMinutes >= 70 && minuteOffset % 4 === 0,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false
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
    momentum: {
      leading_participant_id: seed.momentumParticipantId,
      score: 71,
      direction: "increasing",
      summary:
        "Recent field position and shot volume suggest building pressure",
      reason_codes: ["territory_gain", "shot_volume_increase"]
    },
    live_predictions: {
      win_probabilities: [
        {
          participant_id: seed.identity.participants[0].participant_id,
          probability: isLevel ? 0.39 : homeScore > awayScore ? 0.6 : 0.28
        },
        {
          participant_id: seed.identity.participants[1].participant_id,
          probability: isLevel ? 0.39 : awayScore > homeScore ? 0.6 : 0.28
        }
      ],
      win_probability_changes: [
        {
          participant_id: seed.identity.participants[0].participant_id,
          last_interval: isLevel ? 0.02 : homeScore > awayScore ? 0.08 : -0.08
        },
        {
          participant_id: seed.identity.participants[1].participant_id,
          last_interval: isLevel ? -0.02 : awayScore > homeScore ? 0.08 : -0.08
        }
      ],
      comeback_probability: isLevel
        ? 0.5
        : leader === seed.identity.participants[0].participant_id
          ? 0.32
          : 0.46,
      upset_probability: 0.24,
      draw_probability: isLevel ? 0.27 : 0.16,
      overtime_or_tiebreak_probability: 0.0,
      likely_next_major_event: "shot_on_target",
      expected_remaining_duration_minutes: Math.max(1, 90 - elapsedMinutes),
      prediction_confidence: 0.77
    },
    summary: {
      headline: isLevel
        ? "The MLS match remains in the balance late on"
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
    verification: {
      status: "verified",
      confidence: 0.79,
      warnings: []
    }
  };
};

const buildState = (seed: MatchSeed, minuteOffset: number): LiveState => {
  const [homeBase, awayBase] = seed.scoreSeed;
  if (seed.identity.sport === "soccer") {
    const homeScore = homeBase + (minuteOffset % 2);
    const awayScore = awayBase + ((minuteOffset + 1) % 2);
    return buildSoccerState(seed, minuteOffset, homeScore, awayScore);
  }

  const homeScore = homeBase + (minuteOffset % 7);
  const awayScore = awayBase + ((minuteOffset + 2) % 7);
  return buildBasketballState(seed, minuteOffset, homeScore, awayScore);
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
        {
          participant_id: "bos",
          name: "Boston Celtics",
          short_name: "BOS"
        },
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
        {
          participant_id: "lafc",
          name: "LAFC",
          short_name: "LAFC"
        },
        {
          participant_id: "sea",
          name: "Seattle Sounders",
          short_name: "SEA"
        }
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
    region: "europe",
    identity: {
      match_id: "soccer:epl:2026-06-16:ars:mci",
      sport: "soccer",
      tournament_name: "Premier League",
      scheduled_start_time: "2026-06-16T19:30:00.000Z",
      participants: [
        {
          participant_id: "ars",
          name: "Arsenal",
          short_name: "ARS"
        },
        {
          participant_id: "mci",
          name: "Manchester City",
          short_name: "MCI"
        }
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
    region: "latin-america",
    identity: {
      match_id: "soccer:libertadores:2026-06-16:fla:pal",
      sport: "soccer",
      tournament_name: "Copa Libertadores",
      scheduled_start_time: "2026-06-16T23:10:00.000Z",
      participants: [
        {
          participant_id: "fla",
          name: "Flamengo",
          short_name: "FLA"
        },
        {
          participant_id: "pal",
          name: "Palmeiras",
          short_name: "PAL"
        }
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
        {
          participant_id: "syd",
          name: "Sydney Kings",
          short_name: "SYD"
        },
        {
          participant_id: "mel",
          name: "Melbourne United",
          short_name: "MEL"
        }
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
    upcoming_intelligence: {
      headline: "A likely playoff-preview level contest",
      summary:
        "This game projects as one of the strongest upcoming basketball matchups in the current window.",
      projected_competitiveness: 84,
      watch_reasons: [
        "Both teams are in strong recent form",
        "The matchup has seeding implications",
        "Late-game creation should be tested"
      ],
      win_probabilities: [
        {
          participant_id: "nyk",
          probability: 0.52
        },
        {
          participant_id: "mil",
          probability: 0.48
        }
      ]
    }
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
    upcoming_intelligence: {
      headline: "One of the more volatile MLS fixtures this week",
      summary:
        "The game profiles as high-event, with strong watchability even if prediction confidence is moderate.",
      projected_competitiveness: 79,
      watch_reasons: [
        "High attacking volatility",
        "Potential playoff positioning impact",
        "Open tactical matchup"
      ],
      win_probabilities: [
        {
          participant_id: "mia",
          probability: 0.55
        },
        {
          participant_id: "atl",
          probability: 0.45
        }
      ]
    }
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
        scheduled_start_time: "2026-06-18T18:45:00.000Z",
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
    upcoming_intelligence: {
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
      win_probabilities: [
        {
          participant_id: "int",
          probability: 0.54
        },
        {
          participant_id: "nap",
          probability: 0.46
        }
      ]
    }
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
    upcoming_intelligence: {
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
      win_probabilities: [
        {
          participant_id: "cor",
          probability: 0.5
        },
        {
          participant_id: "flu",
          probability: 0.5
        }
      ]
    }
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
        scheduled_start_time: "2026-06-18T10:05:00.000Z",
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
    upcoming_intelligence: {
      headline: "A strong Asia-Pacific basketball fixture with playoff energy",
      summary:
        "Both teams project well in structured offense, which raises the chance of a close late-game finish.",
      projected_competitiveness: 80,
      watch_reasons: [
        "Playoff-caliber shotmaking",
        "Tight rebounding battle",
        "Late-game execution test"
      ],
      win_probabilities: [
        {
          participant_id: "tok",
          probability: 0.57
        },
        {
          participant_id: "osa",
          probability: 0.43
        }
      ]
    }
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
