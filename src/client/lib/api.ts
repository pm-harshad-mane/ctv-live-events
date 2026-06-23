import type {
  ConfigResponseData,
  DiscoverResponseData,
  LiveContextResponseData,
  LiveStateResponseData,
  StateRefreshResponseData,
  TrackerArchiveDetailResponseData,
  TrackerArchiveListResponseData,
  UpcomingCollectionResponseData,
  UpcomingMatchResponseData
} from "../../shared/types/api";
import type {
  MatchIdentity,
  ProviderMode,
  RequestOrigin,
  TrackerArchiveCreateInput
} from "../../shared/schemas/live";

type Envelope<T> = {
  data: T;
  warnings: string[];
};

export type ApiResult<T> = {
  data: T;
  warnings: string[];
};

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const requestJson = async <T>(
  input: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<Envelope<T>> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    signal
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message ?? "Request failed",
      response.status,
      payload?.error?.code
    );
  }

  return response.json() as Promise<Envelope<T>>;
};

export const fetchConfig = async (
  signal?: AbortSignal
): Promise<ConfigResponseData> => {
  const result = await requestJson<ConfigResponseData>(
    "/api/v1/config",
    undefined,
    signal
  );
  return result.data;
};

export const switchActiveModel = async (
  model: ProviderMode,
  signal?: AbortSignal
): Promise<ConfigResponseData> => {
  const result = await requestJson<ConfigResponseData>(
    "/api/v1/runtime/model",
    {
      method: "POST",
      body: JSON.stringify({ model })
    },
    signal
  );
  return result.data;
};

export const discoverLiveEvents = async (
  input: {
    region: string;
    sport: string;
    include_context?: boolean;
    request_origin?: RequestOrigin;
    known_matches?: Array<{ match_id: string; context_fingerprint: string }>;
  },
  signal?: AbortSignal
): Promise<ApiResult<DiscoverResponseData>> => {
  return requestJson<DiscoverResponseData>(
    "/api/v1/events/live/discover",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    signal
  );
};

export const refreshLiveStates = async (
  input: {
    region: string;
    sport: string;
    request_origin?: RequestOrigin;
    matches: MatchIdentity[];
  },
  signal?: AbortSignal
): Promise<ApiResult<StateRefreshResponseData>> => {
  return requestJson<StateRefreshResponseData>(
    "/api/v1/events/live/state",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    signal
  );
};

export const fetchUpcomingEvents = async (
  input: {
    region: string;
    sport: string;
    days: number;
    request_origin?: RequestOrigin;
  },
  signal?: AbortSignal
): Promise<ApiResult<UpcomingCollectionResponseData>> => {
  const params = new URLSearchParams({
    region: input.region,
    sport: input.sport,
    days: String(input.days),
    request_origin: input.request_origin ?? "unknown"
  });
  return requestJson<UpcomingCollectionResponseData>(
    `/api/v1/events/upcoming?${params.toString()}`,
    undefined,
    signal
  );
};

export const fetchLiveMatchContext = async (
  matchId: string,
  signal?: AbortSignal
): Promise<LiveContextResponseData> => {
  const result = await requestJson<LiveContextResponseData>(
    `/api/v1/events/live/${encodeURIComponent(matchId)}/context`,
    undefined,
    signal
  );
  return result.data;
};

export const fetchLiveMatchState = async (
  matchId: string,
  signal?: AbortSignal
): Promise<LiveStateResponseData> => {
  const result = await requestJson<LiveStateResponseData>(
    `/api/v1/events/live/${encodeURIComponent(matchId)}/state`,
    undefined,
    signal
  );
  return result.data;
};

export const fetchUpcomingMatch = async (
  matchId: string,
  signal?: AbortSignal
): Promise<UpcomingMatchResponseData> => {
  const result = await requestJson<UpcomingMatchResponseData>(
    `/api/v1/events/upcoming/${encodeURIComponent(matchId)}`,
    undefined,
    signal
  );
  return result.data;
};

export const fetchTrackerArchives = async (
  signal?: AbortSignal
): Promise<TrackerArchiveListResponseData> => {
  const result = await requestJson<TrackerArchiveListResponseData>(
    "/api/v1/tracker/archives",
    undefined,
    signal
  );
  return result.data;
};

export const fetchTrackerArchive = async (
  archiveId: string,
  signal?: AbortSignal
): Promise<TrackerArchiveDetailResponseData> => {
  const result = await requestJson<TrackerArchiveDetailResponseData>(
    `/api/v1/tracker/archives/${encodeURIComponent(archiveId)}`,
    undefined,
    signal
  );
  return result.data;
};

export const saveTrackerArchive = async (
  input: TrackerArchiveCreateInput,
  signal?: AbortSignal
): Promise<TrackerArchiveDetailResponseData> => {
  const result = await requestJson<TrackerArchiveDetailResponseData>(
    "/api/v1/tracker/archives",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    signal
  );
  return result.data;
};

export { ApiError };
