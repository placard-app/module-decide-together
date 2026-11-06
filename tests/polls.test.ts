import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createModule } from "../src/server/index.ts"

test("household poll validates, hides counts, changes ballots, reveals ties and preserves results", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "decide-"))
  const module = createModule()
  let enabled = true
  let shared = ["a", "b", "c"]
  async function call(actor: string, path: string, body?: unknown) {
    const response = await module.createHttpApp(
      new Request("http://local/" + path, {
        method: body === undefined ? "GET" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      {
        ownerId: actor,
        dataDir,
        pathSuffix: path,
        hostFetch: async (path) =>
          Response.json(
            path === "/api/me"
              ? { id: actor, householdEnabled: enabled }
              : shared.map((id) => ({ id, name: id, category: "cafe", visibility: "household" })),
          ),
      },
    )
    return { status: response.status, body: await response.json() }
  }
  try {
    assert.equal((await call("", "polls")).status, 401)
    enabled = false
    assert.equal((await call("a", "polls")).status, 403)
    enabled = true
    for (const placeIds of [["a"], ["a", "a"], ["a", "private"]])
      assert.equal((await call("owner", "polls", { title: "Dinner", placeIds })).status, 400)
    const poll = (await call("owner", "polls", { title: "Dinner", placeIds: ["a", "b", "c"] })).body
    assert.equal((await call("owner", `polls/${poll.id}/reveal`, {})).status, 409)
    await call("owner", `polls/${poll.id}/vote`, { placeId: "a" })
    let view = (await call("member", `polls/${poll.id}`)).body
    assert.equal(view.ownVote, null)
    assert.equal("count" in view.options[0], false)
    await call("owner", `polls/${poll.id}/vote`, { placeId: "b" })
    view = (await call("owner", `polls/${poll.id}`)).body
    assert.equal(view.ballotCount, 1)
    assert.equal(view.ownVote, "b")
    assert.equal((await call("member", `polls/${poll.id}/reveal`, {})).status, 403)
    await call("member", `polls/${poll.id}/vote`, { placeId: "a" })
    shared = ["a", "c"]
    view = (await call("owner", `polls/${poll.id}`)).body
    assert.equal(view.ownVote, null)
    assert.equal(view.ballotCount, 1)
    assert.equal(view.options[1].place, null)
    await call("owner", `polls/${poll.id}/vote`, { placeId: "c" })
    const result = (await call("owner", `polls/${poll.id}/reveal`, {})).body
    assert.equal(result.options.filter((o: any) => o.winner).length, 2)
    shared = []
    view = (await call("member", `polls/${poll.id}`)).body
    assert.equal(view.ballotCount, 2)
    assert.ok(view.options.every((o: any) => o.place === null))
    assert.equal((await call("member", `polls/${poll.id}/vote`, { placeId: "a" })).status, 409)
    assert.deepEqual(
      (await call("owner", `polls/${poll.id}/reveal`, {})).body,
      (await call("owner", `polls/${poll.id}`)).body,
    )
    shared = ["a", "b"]
    const race = (await call("owner", "polls", { title: "Race", placeIds: shared })).body
    await call("owner", `polls/${race.id}/vote`, { placeId: "a" })
    const responses = await Promise.all([
      call("owner", `polls/${race.id}/reveal`, {}),
      call("member", `polls/${race.id}/vote`, { placeId: "b" }),
    ])
    const final = (await call("owner", `polls/${race.id}`)).body
    assert.equal(final.revealed, true)
    assert.equal(final.ballotCount, responses[1].status === 200 ? 2 : 1)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
