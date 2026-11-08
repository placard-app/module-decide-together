import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"

test("two household accounts vote, replace an unavailable option and revisit joint favorites", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000)
  const version = JSON.parse(readFileSync("package.json", "utf8")).version
  const headers = { origin: baseURL! }
  const admin = page.request
  expect(
    (
      await admin.post("/api/auth/sign-up/email", {
        headers,
        data: { name: "Organizer", email: "decide@example.com", password: "correct horse battery" },
      })
    ).ok(),
  ).toBeTruthy()
  expect(
    (await admin.patch("/api/admin/settings/household", { headers, data: { enabled: true } })).ok(),
  ).toBeTruthy()
  expect(
    (
      await admin.post("/api/modules/upload", {
        headers,
        data: {
          filename: "places.decide-together.zip",
          contentBase64: readFileSync(`dist/places.decide-together-${version}.zip`).toString("base64"),
        },
      })
    ).ok(),
  ).toBeTruthy()
  const ids: string[] = []
  const garden = "Garden of Rare and Unusual Mediterranean Plants"
  for (const name of [garden, "Cafe", "Museum"]) {
    const result = await admin.post("/api/places/manual", {
      headers,
      data: { name, category: "cafe", location: { lat: 50.85, lng: 4.35 }, address: null },
    })
    const body = await result.json()
    expect(result.ok(), JSON.stringify(body)).toBeTruthy()
    const id = body.place.id
    ids.push(id)
    expect(
      (
        await admin.patch("/api/places/" + id + "/visibility", {
          headers,
          data: { visibility: "household" },
        })
      ).ok(),
    ).toBeTruthy()
  }
  const invitation = await (
    await admin.post("/api/admin/invites", {
      headers,
      data: { email: "decide-member@example.com" },
    })
  ).json()
  const context = await browser.newContext()
  const member = await context.newPage()
  try {
    await member.goto(invitation.url)
    await member.getByLabel("Name", { exact: true }).fill("Member")
    await member.getByLabel("Password", { exact: true }).fill("correct horse battery")
    await member.getByRole("button", { name: "Create account" }).click()
    await expect(member).not.toHaveURL(/invite/)
    async function open(target: typeof page) {
      await target.goto("/")
      await target
        .getByRole("navigation", { name: "Main", exact: true })
        .waitFor({ state: "attached" })
      await target.evaluate(() => {
        history.pushState({}, "", "/m/places.decide-together")
        dispatchEvent(new PopStateEvent("popstate"))
      })
      await expect(
        target.getByRole("heading", { name: "Decide Together", exact: true }),
      ).toBeVisible()
    }
    async function inspectLayout(screen: string) {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBeTruthy()
        await page.screenshot({ path: `test-results/${screen}-${width}.png`, fullPage: true })
      }
    }
    async function inspectPlace(target: typeof page, name: string, id: string) {
      const link = target.getByRole("link", {
        name: `View place: ${name} (opens in a new tab)`,
        exact: true,
      })
      const popup = target.waitForEvent("popup")
      await link.click()
      const detail = await popup
      try {
        await expect(detail).toHaveURL(baseURL + "/places/" + id)
        await expect(detail).toHaveTitle(name + " · Placard")
      } finally {
        await detail.close()
      }
    }
    await open(page)
    await page.getByRole("button", { name: "New poll" }).click()
    await page.getByLabel("Poll title").fill("Saturday")
    for (const name of [garden, "Cafe", "Museum"])
      await page.getByLabel("Shortlist " + name, { exact: true }).check()
    await inspectPlace(page, "Cafe", ids[1])
    await expect(page.getByLabel("Poll title")).toHaveValue("Saturday")
    await expect(page.getByLabel("Shortlist Cafe")).toBeChecked()
    await page.getByLabel("Search places").fill("nonexistent")
    await expect(page.getByText("No places match your search and category.")).toBeVisible()
    await page.getByLabel("Search places").fill("")
    await expect(page.getByText("3 selected")).toBeVisible()
    await inspectLayout("shortlist")
    await page.getByText("Opening hours", { exact: true }).first().click()
    await expect(page.getByText("Hours unavailable").first()).toBeVisible()
    await page.getByRole("button", { name: "Open voting" }).click()
    await page.getByRole("button", { name: "Vote for Cafe", exact: true }).focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Shift+Tab")
    expect(
      await page
        .getByRole("button", { name: "Vote for Cafe" })
        .evaluate((el) => el.matches(":focus-visible")),
    ).toBeTruthy()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("button", { name: "Your vote" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await inspectLayout("ballot")
    await open(member)
    await member.getByRole("button", { name: "Vote", exact: true }).click()
    await inspectPlace(member, "Cafe", ids[1])
    await admin.patch("/api/places/" + ids[1] + "/visibility", {
      headers,
      data: { visibility: "private" },
    })
    await page.reload()
    await expect(page.getByRole("heading", { name: "Saturday" })).toBeVisible()
    await inspectLayout("polls")
    await page.getByRole("button", { name: "Vote", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Place unavailable" })).toBeVisible()
    const unavailable = member
      .getByRole("article")
      .filter({ has: member.getByRole("heading", { name: "Place unavailable" }) })
    await expect(unavailable).toBeVisible({ timeout: 15000 })
    await expect(unavailable.getByRole("link")).toHaveCount(0)
    await expect(unavailable.getByRole("button")).toHaveCount(0)
    await page.getByRole("button", { name: "Vote for " + garden }).click()
    await member.getByRole("button", { name: "Vote for Museum" }).click()
    await expect(member.getByRole("button", { name: "Reveal result" })).toHaveCount(0)
    await page.getByRole("button", { name: "Reveal result" }).click()
    await expect(page.getByRole("heading", { name: "Your joint favorites" })).toBeVisible()
    await member.reload()
    await member.getByRole("button", { name: "View results" }).click()
    await expect(member.getByRole("heading", { name: "Your joint favorites" })).toBeVisible()
    await expect(member.getByRole("link", { name: "View place" })).toHaveCount(2)
    await expect(page.getByText("★ Favorite · 1 vote", { exact: true })).toHaveCount(2)
    await inspectLayout("results")
  } finally {
    await context.close()
  }
})
