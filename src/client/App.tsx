import { useEffect, useState } from "react";
import type { ProviderMode } from "../shared/schemas/live";
import { DetailPanel } from "./components/DetailPanel";
import { EventCard } from "./components/EventCard";
import { LiveMatchTracker } from "./components/LiveMatchTracker";
import { UpcomingCard } from "./components/UpcomingCard";
import { useLiveEvents } from "./hooks/useLiveEvents";

type AppPage = "live" | "upcoming" | "tracker" | "history";

const TERMINAL_HISTORY_STATUSES = new Set([
  "completed",
  "cancelled",
  "postponed"
]);

const formatHistoryStatus = (status: string): string =>
  status
    .split(/[_-]+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const getPageFromHash = (): AppPage =>
  window.location.hash === "#/upcoming"
    ? "upcoming"
    : window.location.hash === "#/tracker"
      ? "tracker"
      : window.location.hash === "#/history"
        ? "history"
      : "live";

export const App = () => {
  const {
    events,
    liveLoading,
    staleMatchIds,
    upcomingEvents,
    upcomingLoading,
    selectedLiveMatchId,
    selectedUpcomingMatchId,
    selectedLiveMatchDetail,
    selectedUpcomingMatchDetail,
    trackedLiveEvent,
    trackableEvents,
    trackerHistory,
    liveWarnings,
    upcomingWarnings,
    detailStatus,
    detailError,
    upcomingDays,
    manualFetchMode,
    periodicUpdatesEnabled,
    upcomingStatusMessage,
    errorMessage,
    filters,
    serviceDisabled,
    statusMessage,
    stateCountdown,
    discoveryCountdown,
    trackedLiveMatchId,
    trackerPollingIntervalSeconds,
    trackerUpdatesEnabled,
    trackerCountdown,
    trackerLoading,
    trackerStatusMessage,
    trackerError,
    trackerLastUpdatedAt,
    trackerArchives,
    selectedTrackerArchive,
    selectedTrackerArchiveId,
    archiveLoading,
    archiveError,
    archiveStatusMessage,
    hasLoadedLiveOnce,
    hasLoadedUpcomingOnce,
    config,
    setFilters,
    setUpcomingDays,
    setPeriodicUpdatesEnabled,
    setTrackerPollingIntervalSeconds,
    selectLiveMatch,
    selectUpcomingMatch,
    selectTrackedLiveMatch,
    selectTrackerArchive,
    clearDetailSelection,
    changeActiveModel,
    loadLiveNow,
    loadUpcomingNow,
    loadTrackerArchivesNow,
    refreshStateNow,
    refreshTrackedMatchNow,
    rediscoverNow,
    retryAfterDisabled
  } = useLiveEvents();
  const [activePage, setActivePage] = useState<AppPage>(() =>
    getPageFromHash()
  );

  const showLiveLoadingState =
    events.length === 0 &&
    (liveLoading ||
      statusMessage.startsWith("Loading live sports intelligence"));
  const showUpcomingLoadingState =
    upcomingEvents.length === 0 &&
    (upcomingLoading ||
      upcomingStatusMessage.startsWith("Loading upcoming matches"));

  useEffect(() => {
    const syncPage = () => {
      setActivePage(getPageFromHash());
    };

    if (!window.location.hash) {
      window.location.hash = "/live";
    } else {
      syncPage();
    }

    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  return (
    <main className="page-shell">
      <section className="hero">
        <h1 className="hero__app-name">Live Sports Intelligence</h1>
      </section>

      <div className="page-controls">
        <nav className="page-nav" aria-label="Sections">
          <a
            href="#/live"
            className={`page-nav__link ${
              activePage === "live" ? "page-nav__link--active" : ""
            }`}
          >
            Live
          </a>
          <a
            href="#/upcoming"
            className={`page-nav__link ${
              activePage === "upcoming" ? "page-nav__link--active" : ""
            }`}
          >
            Upcoming
          </a>
          <a
            href="#/tracker"
            className={`page-nav__link ${
              activePage === "tracker" ? "page-nav__link--active" : ""
            }`}
          >
            Tracker
          </a>
          <a
            href="#/history"
            className={`page-nav__link ${
              activePage === "history" ? "page-nav__link--active" : ""
            }`}
          >
            History
          </a>
        </nav>

        {config ? (
          <label className="page-controls__model-field">
            <span>Data Source</span>
            <select
              value={config.active_model}
              onChange={(event) =>
                void changeActiveModel(event.target.value as ProviderMode)
              }
              disabled={liveLoading || upcomingLoading}
            >
              {config.available_models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <section className="toolbar">
        <label className="toolbar__field">
          <span>Region</span>
          <select
            value={filters.region}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                region: event.target.value
              }))
            }
          >
            <option value="north-america">North America</option>
            <option value="europe">Europe</option>
            <option value="latin-america">Latin America</option>
            <option value="asia-pacific">Asia Pacific</option>
            <option value="global">Global</option>
          </select>
        </label>

        <label className="toolbar__field">
          <span>Sport</span>
          <select
            value={filters.sport}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sport: event.target.value
              }))
            }
          >
            <option value="all">All</option>
            <option value="american-football">American Football</option>
            <option value="baseball">Baseball</option>
            <option value="basketball">Basketball</option>
            <option value="cricket">Cricket</option>
            <option value="hockey">Hockey</option>
            <option value="mma">MMA</option>
            <option value="soccer">Soccer</option>
            <option value="tennis">Tennis</option>
          </select>
        </label>

        {activePage === "upcoming" ? (
          <label className="toolbar__field">
            <span>Upcoming Window</span>
            <select
              value={upcomingDays}
              onChange={(event) => setUpcomingDays(Number(event.target.value))}
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
            </select>
          </label>
        ) : null}

        {activePage === "live" ? (
          <div className="toolbar__actions">
            <button
              type="button"
              onClick={() => void loadLiveNow()}
              disabled={serviceDisabled || liveLoading}
            >
              {hasLoadedLiveOnce ? "Reload live matches" : "Load live matches"}
            </button>
            <button
              type="button"
              onClick={() => void refreshStateNow()}
              disabled={serviceDisabled || !hasLoadedLiveOnce}
            >
              Refresh live state
            </button>
            <button
              type="button"
              onClick={() => void rediscoverNow()}
              disabled={serviceDisabled || !hasLoadedLiveOnce}
            >
              Find new live matches
            </button>
            <label className="toolbar__toggle">
              <input
                type="checkbox"
                checked={periodicUpdatesEnabled}
                onChange={(event) =>
                  setPeriodicUpdatesEnabled(event.target.checked)
                }
                disabled={serviceDisabled || !hasLoadedLiveOnce}
              />
              <span>Periodic live updates</span>
            </label>
          </div>
        ) : activePage === "upcoming" ? (
          <div className="toolbar__actions">
            <button
              type="button"
              onClick={() => void loadUpcomingNow()}
              disabled={serviceDisabled || upcomingLoading}
            >
              {hasLoadedUpcomingOnce
                ? "Reload upcoming matches"
                : "Load upcoming matches"}
            </button>
          </div>
        ) : activePage === "tracker" ? (
          <>
            <label className="toolbar__field toolbar__field--wide">
              <span>Tracked Match</span>
              <select
                value={trackedLiveMatchId ?? ""}
                onChange={(event) => selectTrackedLiveMatch(event.target.value)}
                disabled={liveLoading || trackableEvents.length === 0}
              >
                <option value="">
                  {trackableEvents.length > 0
                    ? "Select one live match"
                    : "No trackable live match available"}
                </option>
                {trackableEvents.map((event) => (
                  <option key={event.match_id} value={event.match_id}>
                    {event.context?.match.match_name ?? event.match_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar__field">
              <span>Refresh cadence</span>
              <select
                value={trackerPollingIntervalSeconds}
                onChange={(event) =>
                  setTrackerPollingIntervalSeconds(Number(event.target.value))
                }
                disabled={!trackedLiveMatchId}
              >
                <option value={60}>1 minute</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={420}>7 minutes</option>
                <option value={600}>10 minutes</option>
              </select>
            </label>

            <div className="toolbar__actions">
              <button
                type="button"
                onClick={() => void loadLiveNow()}
                disabled={serviceDisabled || liveLoading}
              >
                {hasLoadedLiveOnce ? "Reload live matches" : "Load live matches"}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="toolbar__field toolbar__field--wide">
              <span>Archived Event</span>
              <select
                value={selectedTrackerArchiveId ?? ""}
                onChange={(event) => selectTrackerArchive(event.target.value)}
                disabled={archiveLoading || trackerArchives.length === 0}
              >
                <option value="">
                  {trackerArchives.length > 0
                    ? "Select archived tracker event"
                    : "No archived tracked events available"}
                </option>
                {trackerArchives.map((archive) => (
                  <option
                    key={archive.archive_id}
                    value={archive.archive_id}
                  >
                    {archive.match_name} · {new Date(
                      archive.archived_at
                    ).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>

            <div className="toolbar__actions">
              <button
                type="button"
                onClick={() => void loadTrackerArchivesNow()}
                disabled={archiveLoading}
              >
                Reload archived events
              </button>
            </div>
          </>
        )}
      </section>

      {activePage === "live" ? (
        <section className="status-panel">
          <p>{statusMessage}</p>
          {hasLoadedLiveOnce && periodicUpdatesEnabled ? (
            <>
              <p>Next state refresh in {stateCountdown}s</p>
              <p>
                Searching for newly started matches every {discoveryCountdown}s
              </p>
            </>
          ) : hasLoadedLiveOnce ? (
            <p>Periodic live updates are paused.</p>
          ) : null}
          {errorMessage ? (
            <p className="status-panel__error">{errorMessage}</p>
          ) : null}
          {liveWarnings.length > 0 ? (
            <ul className="status-panel__warnings">
              {liveWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : activePage === "upcoming" ? (
        <section className="status-panel">
          <p>{upcomingStatusMessage}</p>
          {upcomingWarnings.length > 0 ? (
            <ul className="status-panel__warnings">
              {upcomingWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : activePage === "tracker" ? (
        <section className="status-panel">
          <p>{trackerStatusMessage}</p>
          {trackerLastUpdatedAt ? (
            <p>
              Last tracker update at{" "}
              {new Date(trackerLastUpdatedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
              })}
            </p>
          ) : null}
          {trackedLiveMatchId && trackerLoading ? (
            <p>{trackerStatusMessage}</p>
          ) : trackedLiveMatchId && trackerUpdatesEnabled ? (
            <p>Next tracker refresh in {trackerCountdown}s</p>
          ) : null}
          {trackerError ? (
            <p className="status-panel__error">{trackerError}</p>
          ) : null}
          {liveWarnings.length > 0 ? (
            <ul className="status-panel__warnings">
              {liveWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section className="status-panel">
          <p>{archiveStatusMessage}</p>
          {archiveError ? (
            <p className="status-panel__error">{archiveError}</p>
          ) : null}
        </section>
      )}

      {serviceDisabled ? (
        <section className="disabled-state">
          <h2>Live sports intelligence is temporarily unavailable.</h2>
          <p>The backend kill switch is active. Automatic refresh is paused.</p>
          <button type="button" onClick={() => void retryAfterDisabled()}>
            Retry
          </button>
        </section>
      ) : null}

      {activePage === "live" ? (
        <section className="section-block">
          <div className="section-header">
            <div>
              <p className="hero__kicker">Live Now</p>
              <h2>Currently live matches.</h2>
            </div>
          </div>
          {showLiveLoadingState ? (
            <div className="loading-state">
              Loading live {filters.sport === "all" ? "events" : filters.sport}
              ...
            </div>
          ) : manualFetchMode && !hasLoadedLiveOnce ? (
            <div className="empty-state">
              Click "Load live matches" to fetch live results for the selected
              filters.
            </div>
          ) : events.length > 0 ? (
            <section className="event-grid">
              {events.map((event) => (
                <EventCard
                  key={event.match_id}
                  event={event}
                  isSelected={event.match_id === selectedLiveMatchId}
                  isStale={staleMatchIds.includes(event.match_id)}
                  onSelect={selectLiveMatch}
                />
              ))}
            </section>
          ) : (
            <div className="empty-state">
              No live {filters.sport === "all" ? "events" : filters.sport}{" "}
              matches are available right now.
            </div>
          )}
        </section>
      ) : activePage === "upcoming" ? (
        <section className="section-block">
          <div className="section-header">
            <div>
              <p className="hero__kicker">Upcoming Spotlight</p>
              <h2>Upcoming matches.</h2>
            </div>
            <p>{upcomingStatusMessage}</p>
          </div>
          {showUpcomingLoadingState ? (
            <div className="loading-state">
              Loading upcoming{" "}
              {filters.sport === "all" ? "matches" : filters.sport}
              ...
            </div>
          ) : manualFetchMode && !hasLoadedUpcomingOnce ? (
            <div className="empty-state">
              Click "Load upcoming matches" to fetch the next slate for the
              selected filters.
            </div>
          ) : upcomingEvents.length > 0 ? (
            <section className="event-grid">
              {upcomingEvents.map((event) => (
                <UpcomingCard
                  key={event.match_id}
                  event={event}
                  isSelected={event.match_id === selectedUpcomingMatchId}
                  onSelect={selectUpcomingMatch}
                />
              ))}
            </section>
          ) : (
            <div className="empty-state">
              No upcoming {filters.sport === "all" ? "matches" : filters.sport}{" "}
              in the selected window.
            </div>
          )}
        </section>
      ) : activePage === "tracker" ? (
        <section className="section-block">
          <div className="section-header">
            <div>
              <p className="hero__kicker">Tracker</p>
              <h2>Follow one live match over time.</h2>
            </div>
          </div>
          {showLiveLoadingState ? (
            <div className="loading-state">
              Loading live {filters.sport === "all" ? "events" : filters.sport}
              ...
            </div>
          ) : manualFetchMode && !hasLoadedLiveOnce ? (
            <div className="empty-state">
              Click "Load live matches" to choose a single live match to track.
            </div>
          ) : trackedLiveEvent ? (
            <LiveMatchTracker
              event={trackedLiveEvent}
              history={trackerHistory}
            />
          ) : events.length > 0 && trackableEvents.length === 0 ? (
            <div className="empty-state">
              Current live payloads were too weak or inconsistent to start a
              reliable tracker session.
            </div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              No live {filters.sport === "all" ? "events" : filters.sport}{" "}
              matches are available to track right now.
            </div>
          ) : (
            <div className="empty-state">
              Choose one of the current live matches from the tracker controls
              to start recording score trends.
            </div>
          )}
        </section>
      ) : (
        <section className="section-block">
          <div className="section-header">
            <div>
              <p className="hero__kicker">Tracker History</p>
              <h2>Past tracked events.</h2>
            </div>
          </div>
          {trackerArchives.length > 0 ? (
            <section className="history-grid" aria-label="Tracked match history">
              {trackerArchives.map((archive) => {
                const incomplete =
                  !TERMINAL_HISTORY_STATUSES.has(archive.final_status);

                return (
                  <button
                    key={archive.archive_id}
                    type="button"
                    className={`history-card ${
                      archive.archive_id === selectedTrackerArchiveId
                        ? "history-card--selected"
                        : ""
                    }`}
                    onClick={() => selectTrackerArchive(archive.archive_id)}
                  >
                    <div className="history-card__eyebrow">
                      <span>{archive.tournament_name}</span>
                      <span>{new Date(archive.archived_at).toLocaleDateString()}</span>
                    </div>
                    <h3>{archive.match_name}</h3>
                    <div className="history-card__meta">
                      <span>{archive.final_score_display}</span>
                      <span>{formatHistoryStatus(archive.final_status)}</span>
                      <span>{archive.history_points} points</span>
                      {incomplete ? <span>Partial capture</span> : null}
                    </div>
                    <p>{archive.venue_summary}</p>
                  </button>
                );
              })}
            </section>
          ) : null}
          {archiveLoading && !selectedTrackerArchive ? (
            <div className="loading-state">Loading archived tracked events...</div>
          ) : selectedTrackerArchive ? (
            <LiveMatchTracker
              event={selectedTrackerArchive.event}
              history={selectedTrackerArchive.history}
            />
          ) : trackerArchives.length > 0 ? (
            <div className="empty-state">
              Select one of the tracked events above to review its time series.
            </div>
          ) : (
            <div className="empty-state">
              No tracked events are available in history yet.
            </div>
          )}
        </section>
      )}

      <DetailPanel
        liveMatchDetail={selectedLiveMatchDetail}
        upcomingEvent={selectedUpcomingMatchDetail}
        status={detailStatus}
        errorMessage={detailError}
        onClear={clearDetailSelection}
      />
    </main>
  );
};
