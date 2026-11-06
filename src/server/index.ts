import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import type { Place, Poll } from "../shared/poll.ts"

export type Context = {
  ownerId: string
  dataDir: string
  pathSuffix?: string
  hostFetch: (path: string, init?: RequestInit) => Promise<Response>
}
class Failure extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
async function host(ctx: Context, path: string, body?: unknown): Promise<any> {
  const response = await ctx.hostFetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  )
  if (!response.ok) throw new Failure(response.status, "Could not load household data")
  return response.json()
}
const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  placeIds: z.array(z.string().min(1)).min(2).max(50),
})
export function createModule() {
  return {
    createHttpApp: async (request: Request, ctx: Context) => {
      let db: DatabaseSync | undefined
      try {
        if (!ctx.ownerId) throw new Failure(401, "Sign in to use Decide Together")
        const me = await host(ctx, "/api/me")
        if (me.id !== ctx.ownerId || !me.householdEnabled)
          throw new Failure(403, "Household mode is required to use Decide Together")
        const path = (ctx.pathSuffix ?? "").replace(/^\/+|\/+$/g, "")
        const places: Place[] = (await host(ctx, "/api/places")).filter(
          (place: Place) => place.visibility === "household",
        )
        const available = new Map(places.map((place) => [place.id, place]))
        if (path === "places" && request.method === "GET")
          return Response.json(places, { headers: { "cache-control": "no-store" } })
        const body = request.method === "POST" ? await request.json() : null
        mkdirSync(ctx.dataDir, { recursive: true })
        db = new DatabaseSync(join(ctx.dataDir, "decide-together.sqlite"))
        db.exec(
          "PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS polls(id TEXT PRIMARY KEY,title TEXT NOT NULL,organizer TEXT NOT NULL,options TEXT NOT NULL,result TEXT); CREATE TABLE IF NOT EXISTS ballots(poll TEXT NOT NULL REFERENCES polls(id),actor TEXT NOT NULL,place TEXT NOT NULL,PRIMARY KEY(poll,actor));",
        )
        const database = db
        const read = (id: string): Poll => {
          const row = database.prepare("SELECT * FROM polls WHERE id=?").get(id)
          if (!row) throw new Failure(404, "Poll not found")
          const ids: string[] = JSON.parse(row.options as string)
          const result: Record<string, number> | null = row.result
            ? JSON.parse(row.result as string)
            : null
          const ballots = database.prepare("SELECT actor,place FROM ballots WHERE poll=?").all(id)
          const eligible = ballots.filter((ballot) => available.has(ballot.place as string))
          const own = ballots.find((ballot) => ballot.actor === ctx.ownerId)?.place as
            | string
            | undefined
          const maximum = result ? Math.max(...Object.values(result)) : 0
          return {
            id,
            title: row.title as string,
            organizerId: row.organizer as string,
            revealed: !!result,
            ownVote: own && available.has(own) ? own : null,
            ballotCount: result
              ? Object.values(result).reduce((a, b) => a + b, 0)
              : eligible.length,
            options: ids.map((placeId) => ({
              placeId,
              place: available.get(placeId) ?? null,
              ...(result
                ? {
                    count: result[placeId] ?? 0,
                    winner: maximum > 0 && result[placeId] === maximum,
                  }
                : {}),
            })),
          }
        }
        let output: unknown
        database.exec("BEGIN IMMEDIATE")
        try {
          if (path === "polls" && request.method === "GET") {
            output = database
              .prepare("SELECT id FROM polls ORDER BY rowid DESC")
              .all()
              .map((row) => read(row.id as string))
          } else if (path === "polls" && request.method === "POST") {
            const input = createInput.parse(body)
            if (new Set(input.placeIds).size !== input.placeIds.length)
              throw new Failure(400, "Choose distinct places")
            if (input.placeIds.some((id) => !available.has(id)))
              throw new Failure(400, "Choose household-shared places")
            const id = randomUUID()
            database
              .prepare("INSERT INTO polls(id,title,organizer,options) VALUES(?,?,?,?)")
              .run(id, input.title, ctx.ownerId, JSON.stringify(input.placeIds))
            output = read(id)
          } else {
            const match = /^polls\/([^/]+)(?:\/(vote|reveal))?$/.exec(path)
            if (!match) throw new Failure(404, "Not found")
            const poll = read(match[1])
            if (request.method === "GET" && !match[2]) output = poll
            else if (request.method === "POST" && match[2] === "vote") {
              if (poll.revealed) throw new Failure(409, "Voting has closed")
              const input = z.object({ placeId: z.string() }).parse(body)
              if (!poll.options.some((option) => option.placeId === input.placeId && option.place))
                throw new Failure(400, "Choose an available place")
              database
                .prepare(
                  "INSERT INTO ballots(poll,actor,place) VALUES(?,?,?) ON CONFLICT(poll,actor) DO UPDATE SET place=excluded.place",
                )
                .run(poll.id, ctx.ownerId, input.placeId)
              output = read(poll.id)
            } else if (request.method === "POST" && match[2] === "reveal") {
              if (poll.organizerId !== ctx.ownerId)
                throw new Failure(403, "Only the organizer can reveal")
              if (!poll.revealed) {
                if (!poll.ballotCount)
                  throw new Failure(409, "At least one eligible vote is required")
                const counts = Object.fromEntries(poll.options.map((option) => [option.placeId, 0]))
                for (const ballot of database
                  .prepare("SELECT place FROM ballots WHERE poll=?")
                  .all(poll.id)) {
                  if (available.has(ballot.place as string)) counts[ballot.place as string]++
                }
                database
                  .prepare("UPDATE polls SET result=? WHERE id=?")
                  .run(JSON.stringify(counts), poll.id)
              }
              output = read(poll.id)
            } else throw new Failure(405, "Method not allowed")
          }
          database.exec("COMMIT")
        } catch (error) {
          database.exec("ROLLBACK")
          throw error
        }
        return Response.json(output, { headers: { "cache-control": "no-store" } })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Operation failed" },
          {
            status:
              error instanceof Failure
                ? error.status
                : error instanceof z.ZodError || error instanceof SyntaxError
                  ? 400
                  : 500,
            headers: { "cache-control": "no-store" },
          },
        )
      } finally {
        db?.close()
      }
    },
  }
}
