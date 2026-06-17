import { useEffect, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { EventCard } from "./components/EventCard";
import { UpcomingCard } from "./components/UpcomingCard";
import { useLiveEvents } from "./hooks/useLiveEvents";

type AppPage = "live" | "upcoming";

const getPageFromHash = (): AppPage =>
  window.location.hash === "#/upcoming" ? "upcoming" : "live";

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
    liveWarnings,
    upcomingWarnings,
    detailStatus,
    detailError,
    upcomingDays,
    upcomingStatusMessage,
    errorMessage,
    filters,
    serviceDisabled,
    statusMessage,
    stateCountdown,
    discoveryCountdown,
    hasLoadedLiveOnce,
    setFilters,
    setUpcomingDays,
    selectLiveMatch,
    selectUpcomingMatch,
    clearDetailSelection,
    refreshStateNow,
    rediscoverNow,
    retryAfterDisabled
  } = useLiveEvents();
  const [activePage, setActivePage] = useState<AppPage>(() =>
    getPageFromHash()
  );

  const showLiveLoadingState =
    events.length === 0 &&
    (!hasLoadedLiveOnce ||
      liveLoading ||
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
        <div>
          <p className="hero__kicker">Live Sports Intelligence</p>
          <h1>
            {activePage === "live"
              ? "Track currently live matches with fast state refresh."
              : "Review upcoming matches with pre-match intelligence."}
          </h1>
        </div>
        <div className="hero__meta">
          <p className="hero__copy">
            {activePage === "live"
              ? "The live page focuses on discovery, score updates, and rapid match inspection."
              : "The upcoming page focuses on context, projected competitiveness, and win probabilities."}
          </p>
          <div className="hero__stats">
            <div>
              <strong>{events.length}</strong>
              <span>Live matches</span>
            </div>
            <div>
              <strong>{upcomingEvents.length}</strong>
              <span>Upcoming spotlight</span>
            </div>
          </div>
        </div>
      </section>

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
      </nav>

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
              onClick={() => void refreshStateNow()}
              disabled={serviceDisabled}
            >
              Refresh live state
            </button>
            <button
              type="button"
              onClick={() => void rediscoverNow()}
              disabled={serviceDisabled}
            >
              Find new live matches
            </button>
          </div>
        ) : null}
      </section>

      {activePage === "live" ? (
        <section className="status-panel">
          <p>{statusMessage}</p>
          {hasLoadedLiveOnce ? (
            <>
              <p>Next state refresh in {stateCountdown}s</p>
              <p>
                Searching for newly started matches every {discoveryCountdown}s
              </p>
            </>
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
      ) : (
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
      ) : (
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
