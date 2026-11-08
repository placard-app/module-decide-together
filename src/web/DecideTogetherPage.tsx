import { useEffect, useState } from "react"
import type { Place, Poll } from "../shared/poll.ts"

import { styles } from "./styles.ts"

const API = "/api/m/places.decide-together"
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(API + path, {
    credentials: "include",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error ?? "Could not load Decide Together")
  return value
}
function Hours({ place }: { place: Place }) {
  const hours = place.facts?.openingHours
  const time = (value: { day: number; hour: number; minute: number }) =>
    `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][value.day]} ${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`
  return (
    <details>
      <summary>Opening hours</summary>
      {hours?.weekdayDescriptions?.length ? (
        hours.weekdayDescriptions.map((line) => <div key={line}>{line}</div>)
      ) : hours?.periods.length ? (
        hours.periods.map((period, index) => (
          <div key={index}>
            {time(period.open)} – {period.close ? time(period.close) : "Open continuously"}
          </div>
        ))
      ) : (
        <p>Hours unavailable</p>
      )}
      {place.facts?.fromGoogle && <small>Place information from Google</small>}
    </details>
  )
}
function ballots(count: number) {
  return count + (count === 1 ? " ballot" : " ballots")
}

function Card({
  place,
  marked,
  children,
}: {
  place: Place | null
  marked?: boolean
  children?: React.ReactNode
}) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  return (
    <article className={"dt-card" + (marked ? " dt-marked" : "")}>
      {place?.coverThumbUrl && failedPhoto !== place.coverThumbUrl && (
        <img
          className="dt-photo"
          src={place.coverThumbUrl}
          alt=""
          onError={() => setFailedPhoto(place.coverThumbUrl ?? null)}
        />
      )}
      <div className="dt-body">
        <div>
          {place && <p className="dt-category">{place.category.replaceAll("_", " ")}</p>}
          <h3>{place?.name ?? "Place unavailable"}</h3>
        </div>
        {place ? (
          <Hours place={place} />
        ) : (
          <p className="dt-muted">This place is no longer available to the household.</p>
        )}
        {(children || place) && (
          <div className="dt-actions dt-card-footer">
            {children}
            {place && (
              <a
                className="dt-link"
                href={"/places/" + encodeURIComponent(place.id)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View place: ${place.name} (opens in a new tab)`}
              >
                View place <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
export function DecideTogetherPage() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [current, setCurrent] = useState<Poll | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [actor, setActor] = useState("")
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [household, setHousehold] = useState(true)
  async function load() {
    const me = await (await fetch("/api/me", { credentials: "include" })).json()
    setActor(me.id)
    setHousehold(!!me.householdEnabled)
    if (!me.householdEnabled) return
    const [list, pool] = await Promise.all([api<Poll[]>("/polls"), api<Place[]>("/places")])
    setPolls(list)
    setPlaces(pool)
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setReady(true))
  }, [])
  useEffect(() => {
    if (!current || current.revealed || busy) return
    let active = true
    const timer = setInterval(() => {
      void api<Poll>("/polls/" + current.id)
        .then((poll) => {
          if (active) setCurrent(poll)
        })
        .catch((e) => setError(e.message))
    }, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [current?.id, current?.revealed, busy])
  async function action(work: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed")
    } finally {
      setBusy(false)
    }
  }
  const matches = places.filter(
    (place) =>
      place.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!category || place.category === category),
  )
  return (
    <main className="dt-page">
      <style>{styles}</style>
      {error && (
        <p role="alert" className="dt-error">
          {error}
        </p>
      )}
      {current && (
        <button
          className="dt-back"
          disabled={busy}
          onClick={() => {
            setCurrent(null)
            void action(load)
          }}
        >
          ← Back to polls
        </button>
      )}
      <header>
        <h1>{current?.title ?? (creating ? "Choose your shortlist" : "Decide Together")}</h1>
        {current ? (
          <>
            <div className="dt-meta">
              <span className="dt-status">
                {current.revealed ? "Voting closed" : "Voting open"}
              </span>
              <span className="dt-muted" aria-live="polite">
                {ballots(current.ballotCount)} {current.revealed ? "counted" : "cast"}
              </span>
            </div>
            {!current.revealed && (
              <p>
                Choose one favorite. You can change your vote until the organizer reveals the
                result.
              </p>
            )}
          </>
        ) : (
          !creating && <p className="dt-muted">Choose a place to visit with your household.</p>
        )}
      </header>
      {!ready ? (
        <p role="status">Loading household…</p>
      ) : !household ? (
        <p>Household mode is required. Enable it in Placard settings to choose a place together.</p>
      ) : current ? (
        <>
          {current.revealed ? (
            <h2 className="dt-section">
              {current.options.filter((o) => o.winner).length > 1
                ? "Your joint favorites"
                : "Your household’s favorite"}
            </h2>
          ) : (
            <p className="dt-notice">
              Places must stay shared with your household for everyone to view their details.
            </p>
          )}
          <div className="dt-grid">
            {current.options.map((option) => {
              const voted = current.ownVote === option.placeId
              return (
                <Card
                  key={option.placeId}
                  place={option.place}
                  marked={current.revealed ? option.winner : voted}
                >
                  {current.revealed ? (
                    <p className={option.winner ? "dt-winner" : ""}>
                      {option.winner && "★ Favorite · "}
                      {option.count} {option.count === 1 ? "vote" : "votes"}
                    </p>
                  ) : (
                    option.place && (
                      <button
                        className={"dt-button" + (voted ? " dt-primary" : "")}
                        aria-pressed={voted}
                        aria-label={voted ? "Your vote" : "Vote for " + option.place.name}
                        disabled={busy}
                        onClick={() =>
                          void action(async () =>
                            setCurrent(
                              await api<Poll>("/polls/" + current.id + "/vote", {
                                placeId: option.placeId,
                              }),
                            ),
                          )
                        }
                      >
                        {voted ? (
                          <>
                            <span aria-hidden="true">✓ </span>Your vote
                          </>
                        ) : (
                          "Vote"
                        )}
                      </button>
                    )
                  )}
                </Card>
              )
            })}
          </div>
          {!current.revealed && current.organizerId === actor && (
            <div className="dt-actions dt-footer">
              <button
                className="dt-button dt-primary"
                disabled={busy || !current.ballotCount}
                onClick={() =>
                  void action(async () =>
                    setCurrent(await api<Poll>("/polls/" + current.id + "/reveal", {})),
                  )
                }
              >
                Reveal result
              </button>
              <p className="dt-muted">Revealing the result closes voting for everyone.</p>
            </div>
          )}
        </>
      ) : creating ? (
        <>
          <label className="dt-field">
            Poll title
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <p className="dt-notice">
            To include a place, open it in Placard and choose ‘Share with household’. Everyone in
            your household can then view its details.
          </p>
          <div className="dt-filters">
            <label className="dt-field">
              Search places
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="dt-field">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {[...new Set(places.map((p) => p.category))].sort().map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="dt-meta dt-section">
            <h2>Choose 2–50 places</h2>
            <span className="dt-status" aria-live="polite">
              {selected.length} selected
            </span>
          </div>
          <div className="dt-grid">
            {matches.map((place) => {
              const checked = selected.includes(place.id)
              return (
                <Card key={place.id} place={place} marked={checked}>
                  <label className="dt-choice">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={"Shortlist " + place.name}
                      disabled={!checked && selected.length >= 50}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, place.id]
                            : selected.filter((id) => id !== place.id),
                        )
                      }
                    />
                    Shortlist
                  </label>
                </Card>
              )
            })}
          </div>
          {!places.length ? (
            <p>No places are shared with your household yet.</p>
          ) : (
            !matches.length && <p>No places match your search and category.</p>
          )}
          <div className="dt-actions dt-footer">
            <button
              className="dt-button dt-primary"
              disabled={busy || !title.trim() || selected.length < 2 || selected.length > 50}
              onClick={() =>
                void action(async () => {
                  setCurrent(await api<Poll>("/polls", { title, placeIds: selected }))
                  setCreating(false)
                })
              }
            >
              Open voting
            </button>
            <button className="dt-button" disabled={busy} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="dt-actions">
            <button
              className="dt-button dt-primary"
              disabled={busy}
              onClick={() => {
                setTitle("")
                setSelected([])
                setQuery("")
                setCategory("")
                setCreating(true)
                void action(load)
              }}
            >
              New poll
            </button>
            <button className="dt-button" disabled={busy} onClick={() => void action(load)}>
              Refresh polls
            </button>
          </div>
          <h2 className="dt-section">Household polls</h2>
          {!polls.length && (
            <p className="dt-muted">
              No polls yet. Start with a few places you would like to visit.
            </p>
          )}
          <div className="dt-grid">
            {polls.map((poll) => (
              <article className="dt-card dt-body" key={poll.id}>
                <div className="dt-meta">
                  <span className="dt-status">
                    {poll.revealed ? "Result revealed" : "Voting open"}
                  </span>
                  <span className="dt-muted">{ballots(poll.ballotCount)}</span>
                </div>
                <h3>{poll.title}</h3>
                <div>
                  <button
                    className="dt-button"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => setCurrent(await api<Poll>("/polls/" + poll.id)))
                    }
                  >
                    {poll.revealed ? "View results" : "Vote"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
