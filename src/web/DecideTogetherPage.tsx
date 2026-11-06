import { useEffect, useState } from "react"
import type { Place, Poll } from "../shared/poll.ts"

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
function Card({ place, children }: { place: Place | null; children?: React.ReactNode }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  return (
    <article className="dt-card">
      {place ? (
        <>
          <div className="dt-photo">
            {place.coverThumbUrl && failedPhoto !== place.coverThumbUrl ? (
              <img
                src={place.coverThumbUrl}
                alt=""
                onError={() => setFailedPhoto(place.coverThumbUrl ?? null)}
              />
            ) : (
              <span>No photo available</span>
            )}
          </div>
          <div className="dt-card-body">
            <h3>{place.name}</h3>
            <p>{place.category.replaceAll("_", " ")}</p>
            <Hours place={place} />
            {children}
          </div>
        </>
      ) : (
        <div className="dt-card-body">
          <h3>Place unavailable</h3>
          <p>This place is no longer shared with the household.</p>
          {children}
        </div>
      )}
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
  return (
    <main className="dt-page">
      <style>{`
.dt-page{max-width:1080px;margin:auto;padding:32px 20px;color:var(--foreground,inherit);font-family:inherit}.dt-page h1{font-size:clamp(28px,5vw,44px);letter-spacing:-.04em;margin-bottom:8px}.dt-page h3{margin:0;font-size:20px}.dt-page button,.dt-page input,.dt-page select{font:inherit;border:1px solid #9ca8a3;border-radius:10px;padding:10px 14px;background:var(--background,white);color:inherit}.dt-page button{cursor:pointer}.dt-page button:disabled{opacity:.5;cursor:default}.dt-page button:focus-visible,.dt-page input:focus-visible,.dt-page select:focus-visible{outline:3px solid #329d84;outline-offset:3px}.dt-page .dt-primary{background:#176956;color:white;border-color:#176956}.dt-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:24px 0}.dt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:20px}.dt-card{border:1px solid #a8b6af;border-radius:16px;overflow:hidden}.dt-photo{height:160px;background:#e3ebe6;color:#395c4d;display:grid;place-items:center}.dt-photo img{width:100%;height:100%;object-fit:cover}.dt-card-body{padding:20px}.dt-card-body p{margin:8px 0 16px}.dt-card-body button,.dt-card-body a{display:inline-block;margin-top:18px}.dt-page summary{cursor:pointer}.dt-page label{display:flex;gap:8px;align-items:center}.dt-page input[type=text]{max-width:100%;box-sizing:border-box}.dt-page .dt-title{width:100%;margin:20px 0}.dt-error{border:1px solid #c65b50;padding:14px;border-radius:10px}.dt-winner{font-weight:bold;color:#21846a}
`}</style>
      <h1>Decide Together</h1>
      <p>Find the place everyone is looking forward to.</p>
      {error && (
        <p role="alert" className="dt-error">
          {error}
        </p>
      )}
      {!ready ? (
        <p role="status">Loading household…</p>
      ) : !household ? (
        <p>Household mode is required. Enable it in Placard settings to choose a place together.</p>
      ) : current ? (
        <>
          <button
            onClick={() => {
              setCurrent(null)
              void action(load)
            }}
          >
            Back to polls
          </button>
          <h2>{current.title}</h2>
          <p aria-live="polite">
            {current.ballotCount} {current.ballotCount === 1 ? "ballot" : "ballots"}{" "}
            {current.revealed ? "counted" : "cast"}
          </p>
          {current.revealed ? (
            <h2>
              {current.options.filter((o) => o.winner).length > 1
                ? "Your joint favorites"
                : "Your household’s favorite"}
            </h2>
          ) : (
            <p>
              Choose one favorite. You can change your vote until the organizer reveals the result.
            </p>
          )}
          <div className="dt-grid">
            {current.options.map((option) => (
              <Card key={option.placeId} place={option.place}>
                {current.revealed ? (
                  <>
                    <p className={option.winner ? "dt-winner" : ""}>
                      {option.winner && "★ Favorite · "}
                      {option.count} {option.count === 1 ? "vote" : "votes"}
                    </p>
                    {option.place && (
                      <a href={"/places/" + encodeURIComponent(option.placeId)}>View place</a>
                    )}
                  </>
                ) : (
                  option.place && (
                    <button
                      aria-pressed={current.ownVote === option.placeId}
                      disabled={busy}
                      className={current.ownVote === option.placeId ? "dt-primary" : ""}
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
                      {current.ownVote === option.placeId
                        ? "Your vote"
                        : "Vote for " + option.place.name}
                    </button>
                  )
                )}
              </Card>
            ))}
          </div>
          {!current.revealed && current.organizerId === actor && (
            <div className="dt-toolbar">
              <button
                className="dt-primary"
                disabled={busy || !current.ballotCount}
                onClick={() =>
                  void action(async () =>
                    setCurrent(await api<Poll>("/polls/" + current.id + "/reveal", {})),
                  )
                }
              >
                Reveal result
              </button>
            </div>
          )}
        </>
      ) : creating ? (
        <>
          <h2>Choose your shortlist</h2>
          <label>
            Poll title
            <input
              className="dt-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="dt-toolbar">
            <label>
              Search places
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
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
          <p>{selected.length} places selected. Choose at least two household-shared places.</p>
          <div className="dt-grid">
            {places
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(query.toLowerCase()) &&
                  (!category || p.category === category),
              )
              .map((place) => (
                <Card key={place.id} place={place}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(place.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, place.id]
                            : selected.filter((id) => id !== place.id),
                        )
                      }
                    />
                    Shortlist {place.name}
                  </label>
                </Card>
              ))}
          </div>
          {!places.length && (
            <p>Share places with your household in Placard to build a shortlist.</p>
          )}
          <div className="dt-toolbar">
            <button
              className="dt-primary"
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
            <button onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="dt-toolbar">
            <button
              className="dt-primary"
              onClick={() => {
                setTitle("")
                setSelected([])
                setCreating(true)
                void action(load)
              }}
            >
              New poll
            </button>
            <button disabled={busy} onClick={() => void action(load)}>
              Refresh polls
            </button>
          </div>
          {!polls.length && <p>No polls yet. Start with a few places you would like to visit.</p>}
          <div className="dt-grid">
            {polls.map((poll) => (
              <article className="dt-card dt-card-body" key={poll.id}>
                <h2>{poll.title}</h2>
                <p>
                  {poll.revealed ? "Result revealed" : "Voting open"} · {poll.ballotCount} ballots
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => setCurrent(await api<Poll>("/polls/" + poll.id)))
                  }
                >
                  Open {poll.title}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
