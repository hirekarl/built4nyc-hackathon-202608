import { expect, test, type Locator, type Page } from "@playwright/test";
import type { IntersectionReport } from "../src/types/report";

/**
 * Phase 3 Steps 3.3 + 3.5 — end-to-end correctness gate.
 *
 * Unlike every other e2e spec in this repo, this one does NOT stub
 * `**\/resource/*.json**` or `**\/api/reports/intersection**`. It drives the
 * real UI against the real `/api/reports/intersection` route, which itself
 * calls live NYC Open Data (Socrata). This is intentionally the one spec
 * that can catch true end-to-end drift between the documented PRD §12
 * fixtures and what the live dataset currently returns.
 *
 * Both fixture coordinates sit inside the map's default initial viewport
 * (center [-73.9802, 40.7525], zoom 14.5), so no pan/zoom is required to
 * reach them via the keyboard proxy list (reused from
 * `report-panel-a11y.spec.ts`) — see that spec for the established
 * interaction patterns this file reuses rather than reinventing.
 */

const NETWORK_TIMEOUT = 90_000;

interface FixtureExpectation {
  readonly caseName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly displayName: string;
  readonly status: "complete" | "partial";
  readonly priorityZoneStatus: "matched" | "not_matched" | "unavailable";
  readonly metrics: {
    crashes: number;
    peopleInjured: number;
    peopleKilled: number;
    pedestriansInjured: number;
    pedestriansKilled: number;
    cyclistsInjured: number;
    cyclistsKilled: number;
    motoristsInjured: number;
    motoristsKilled: number;
    unspecifiedFactors: number;
  };
  readonly contributingFactors?: ReadonlyArray<{
    factor: string;
    count: number;
  }>;
  readonly limitations: readonly string[];
  readonly notes: readonly string[];
}

// PRD §12 fixture 1 — W 40 ST at 5 AVE. The server (and the client's own
// centerline grouping) resolves the *official* multi-street node name, which
// is NOT the PRD's shorthand label — see the naming fallback documented in
// src/lib/centerline-client.ts.
const FIXTURE_1: FixtureExpectation = {
  caseName: "W 40 ST at 5 AVE",
  latitude: 40.752205375223,
  longitude: -73.981823738617,
  displayName: "E 40 ST at 5 AVE at W 40 ST",
  status: "complete",
  priorityZoneStatus: "matched",
  metrics: {
    crashes: 6,
    peopleInjured: 7,
    peopleKilled: 1,
    pedestriansInjured: 4,
    pedestriansKilled: 1,
    cyclistsInjured: 1,
    cyclistsKilled: 0,
    motoristsInjured: 2,
    motoristsKilled: 0,
    unspecifiedFactors: 2,
  },
  contributingFactors: [
    { factor: "Driver Inattention/Distraction", count: 4 },
    { factor: "Backing Unsafely", count: 2 },
    { factor: "Traffic Control Disregarded", count: 1 },
  ],
  limitations: [],
  notes: [],
};

// PRD §12 fixture 2 — E 42 ST at PARK AVE.
const FIXTURE_2: FixtureExpectation = {
  caseName: "E 42 ST at PARK AVE",
  latitude: 40.752175843845,
  longitude: -73.977792815236,
  displayName: "PARK AVE at E 42 ST",
  status: "complete",
  priorityZoneStatus: "matched",
  metrics: {
    crashes: 9,
    peopleInjured: 4,
    peopleKilled: 0,
    pedestriansInjured: 2,
    pedestriansKilled: 0,
    cyclistsInjured: 2,
    cyclistsKilled: 0,
    motoristsInjured: 0,
    motoristsKilled: 0,
    unspecifiedFactors: 6,
  },
  limitations: ["3 of 9 crash records are missing on_street_name."],
  notes: [
    "The matched crash records had coordinates, so missing street labels do not change the coordinate-based counts.",
  ],
};

const EXPECTED_SOURCES = [
  { datasetId: "inkn-q76z", name: "NYC Street Centerline" },
  { datasetId: "h9gi-nx95", name: "Motor Vehicle Collisions - Crashes" },
  { datasetId: "qzji-nvbd", name: "VZV Priority Zones or Areas" },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coordinateLabelRegExp(latitude: number, longitude: number): RegExp {
  const lat = escapeRegExp(latitude.toFixed(6));
  const lng = escapeRegExp(longitude.toFixed(6));
  return new RegExp(`${lat}.*${lng}`);
}

/**
 * Retry/backoff harness for the map's live centerline fetch (Socrata). This
 * lives in the TEST, not the app: the app's own retry affordance (the map's
 * "Retry" button, driven by a genuine source-failure state) is simply
 * clicked again with a short backoff if the initial viewport load fails.
 */
async function openProxyListWithCandidates(
  page: Page,
  attempts = 4,
): Promise<void> {
  const proxyToggle = page.getByRole("button", {
    name: "Choose an intersection without using the map",
  });
  if ((await proxyToggle.getAttribute("aria-expanded")) !== "true") {
    await proxyToggle.click();
  }

  const firstCandidate = page.locator(".intersection-proxy-list li").first();
  const mapControls = page.locator(".map-floating-controls");
  const mapRetryButton = mapControls.getByRole("button", { name: "Retry" });

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const outcome = await Promise.race([
      firstCandidate
        .waitFor({ state: "attached", timeout: NETWORK_TIMEOUT })
        .then(() => "ready" as const),
      mapRetryButton
        .waitFor({ state: "visible", timeout: NETWORK_TIMEOUT })
        .then(() => "retry" as const),
    ]).catch(() => "timeout" as const);

    if (outcome === "ready") return;
    if (attempt === attempts) {
      throw new Error(
        `Map candidates never loaded after ${attempt} attempts (last outcome: ${outcome}). The live NYC Street Centerline fetch may be down.`,
      );
    }
    if (outcome === "retry") {
      await page.waitForTimeout(1000 * attempt);
      await mapRetryButton.click();
    } else {
      // Timed out waiting on either signal — try again from a fresh load.
      await page.waitForTimeout(1000 * attempt);
      await page.reload();
      if ((await proxyToggle.getAttribute("aria-expanded")) !== "true") {
        await proxyToggle.click();
      }
    }
  }
}

async function selectIntersectionByCoordinate(
  page: Page,
  latitude: number,
  longitude: number,
): Promise<Locator> {
  await openProxyListWithCandidates(page);

  const target = page.getByRole("button", {
    name: coordinateLabelRegExp(latitude, longitude),
  });
  const showMore = page.getByRole("button", {
    name: "Show more intersections",
  });

  for (let i = 0; i < 30; i++) {
    if ((await target.count()) > 0) break;
    if ((await showMore.count()) === 0) break;
    await showMore.click();
  }

  await expect(
    target,
    `Expected an intersection at ${latitude}, ${longitude} in the default map viewport's proxy list.`,
  ).toHaveCount(1);
  return target;
}

/**
 * Retry/backoff harness for report generation (Socrata collisions +
 * priority-zone lookups). On a genuine `source-failure` response the panel
 * exposes its own "Retry" button (real app behavior); the harness just
 * re-triggers it with backoff rather than the app looping internally. Also
 * captures the raw JSON response so assertions can check the exact
 * server-computed report object, not just its rendered text.
 *
 * Drives generation exactly once end to end per attempt (click → optional
 * loading cue → response → complete state). The caller must NOT click
 * "Generate safety report" itself first — this function owns that click.
 */
async function completeReport(
  page: Page,
  panel: Locator,
  { assertLoadingCue = false }: { assertLoadingCue?: boolean } = {},
  attempts = 3,
): Promise<{ article: Locator; report: IntersectionReport }> {
  const generateButton = panel.getByRole("button", {
    name: "Generate safety report",
  });
  const retryButton = panel.getByRole("button", { name: "Retry" });
  const liveRegion = panel.locator('[aria-live="polite"]');

  let trigger = generateButton;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/reports/intersection") &&
          response.request().method() === "POST",
        { timeout: NETWORK_TIMEOUT },
      );
      await trigger.click({ timeout: 10_000 });

      if (assertLoadingCue) {
        await expect(liveRegion).toContainText("Retrieving NYC Open Data", {
          timeout: 10_000,
        });
      }

      const response = await responsePromise;

      if (!response.ok()) {
        throw new Error(
          `/api/reports/intersection responded with ${response.status()} on attempt ${attempt}.`,
        );
      }

      const report = (await response.json()) as IntersectionReport;
      const article = panel.getByRole("article", {
        name: "On-screen safety report",
      });
      await expect(article).toBeVisible({ timeout: NETWORK_TIMEOUT });
      return { article, report };
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await page.waitForTimeout(1000 * attempt);
      trigger = (await retryButton.count()) > 0 ? retryButton : generateButton;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Report generation did not complete after retries.");
}

function metricRow(scope: Locator, label: string): Locator {
  return scope.locator(".metric-row", { hasText: label });
}

async function expectMetric(
  scope: Locator,
  label: string,
  value: number,
): Promise<void> {
  const row = metricRow(scope, label);
  await expect(row.locator("dt")).toHaveText(label);
  await expect(row.locator("dd")).toHaveText(String(value));
}

async function expectMetrics(
  scope: Locator,
  metrics: FixtureExpectation["metrics"],
): Promise<void> {
  await expectMetric(scope, "Crashes", metrics.crashes);
  await expectMetric(scope, "People injured", metrics.peopleInjured);
  await expectMetric(scope, "People killed", metrics.peopleKilled);
  await expectMetric(scope, "Pedestrians injured", metrics.pedestriansInjured);
  await expectMetric(scope, "Pedestrians killed", metrics.pedestriansKilled);
  await expectMetric(scope, "Cyclists injured", metrics.cyclistsInjured);
  await expectMetric(scope, "Cyclists killed", metrics.cyclistsKilled);
  await expectMetric(scope, "Motorists injured", metrics.motoristsInjured);
  await expectMetric(scope, "Motorists killed", metrics.motoristsKilled);
  await expectMetric(scope, "Unspecified", metrics.unspecifiedFactors);
}

async function expectContributingFactors(
  scope: Locator,
  factors: ReadonlyArray<{ factor: string; count: number }>,
): Promise<void> {
  const items = scope.locator(".factor-list li");
  await expect(items).toHaveCount(factors.length);
  for (const { factor, count } of factors) {
    await expect(
      scope.locator(".factor-list li", { hasText: factor }),
    ).toHaveText(`${factor}: ${count}`);
  }
}

async function expectSources(scope: Locator): Promise<void> {
  for (const { datasetId, name } of EXPECTED_SOURCES) {
    const sourceItem = scope.locator(".source-list li", { hasText: name });
    await expect(sourceItem).toContainText(datasetId);
    await expect(sourceItem).toContainText("available");
  }
}

async function assertReportMatchesFixture(
  report: IntersectionReport,
  fixture: FixtureExpectation,
): Promise<void> {
  expect(report.schemaVersion).toBe("1");
  expect(report.selection.displayName).toBe(fixture.displayName);
  expect(report.status).toBe(fixture.status);
  expect(report.priorityZone.status).toBe(fixture.priorityZoneStatus);
  expect(report.metrics.crashes).toBe(fixture.metrics.crashes);
  expect(report.metrics.peopleInjured).toBe(fixture.metrics.peopleInjured);
  expect(report.metrics.peopleKilled).toBe(fixture.metrics.peopleKilled);
  expect(report.metrics.pedestriansInjured).toBe(
    fixture.metrics.pedestriansInjured,
  );
  expect(report.metrics.pedestriansKilled).toBe(
    fixture.metrics.pedestriansKilled,
  );
  expect(report.metrics.cyclistsInjured).toBe(fixture.metrics.cyclistsInjured);
  expect(report.metrics.cyclistsKilled).toBe(fixture.metrics.cyclistsKilled);
  expect(report.metrics.motoristsInjured).toBe(
    fixture.metrics.motoristsInjured,
  );
  expect(report.metrics.motoristsKilled).toBe(fixture.metrics.motoristsKilled);
  expect(report.metrics.unspecifiedFactors).toBe(
    fixture.metrics.unspecifiedFactors,
  );
  expect(report.limitations).toEqual([...fixture.limitations]);
  expect(report.notes).toEqual([...fixture.notes]);
  expect(report.sources.map((source) => source.datasetId).sort()).toEqual(
    EXPECTED_SOURCES.map((source) => source.datasetId).sort(),
  );
  for (const source of report.sources) {
    expect(source.retrievalStatus).toBe("available");
  }
  if (fixture.contributingFactors) {
    expect(report.metrics.contributingFactors).toEqual([
      ...fixture.contributingFactors,
    ]);
  }
}

test.describe("Live end-to-end report flow (real NYC Open Data, no stubs)", () => {
  // Be a polite, low-concurrency client against Socrata: run the two
  // live-network fixtures one at a time rather than in parallel workers.
  test.describe.configure({ mode: "serial" });

  test(`full happy-path flow: map to printed report — ${FIXTURE_1.caseName}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/");

    // 1. Load map, open the keyboard proxy (map interaction substitute
    // used throughout this repo's e2e suite), hover/focus an intersection
    // and confirm its street names are surfaced.
    const target = await selectIntersectionByCoordinate(
      page,
      FIXTURE_1.latitude,
      FIXTURE_1.longitude,
    );
    await target.focus();
    await expect(page.locator(".map-status")).toContainText(
      FIXTURE_1.displayName,
    );

    // 2. Select it — the report panel confirms the selection and its 50m
    // analysis boundary.
    await target.click();
    await expect(target).toHaveAttribute("aria-pressed", "true");

    const panel = page.getByRole("complementary", {
      name: /safety report/i,
    });
    const liveRegion = panel.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText(`${FIXTURE_1.displayName} selected`);
    await expect(panel).toContainText("50 meters (about 164 feet)");

    // 3. Confirm/request the report, observe the loading state, and wait
    // for the complete state via the real backend — with harness
    // retry/backoff for transient Socrata failures.
    const { article, report } = await completeReport(page, panel, {
      assertLoadingCue: true,
    });
    expect(report.status).toBe(FIXTURE_1.status);

    await expect(article).toContainText(FIXTURE_1.displayName);
    await expect(article).toContainText("Complete report");
    await expectMetrics(article, FIXTURE_1.metrics);
    if (FIXTURE_1.contributingFactors) {
      await expectContributingFactors(article, FIXTURE_1.contributingFactors);
    }

    // 4. Inspect the sources list.
    await expectSources(article);

    // 5. Exact-value acceptance check against the live backend response.
    await assertReportMatchesFixture(report, FIXTURE_1);

    // 6. Trigger print/download.
    await page.evaluate(() => {
      window.print = () => {
        document.documentElement.dataset.printCalled = "true";
      };
    });
    const printButton = panel.getByRole("button", {
      name: "Print or save as PDF",
    });
    await printButton.click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-print-called",
      "true",
    );

    const printReport = page.getByRole("article", {
      name: "Printable safety report",
      includeHidden: true,
    });
    await page.emulateMedia({ media: "print" });
    await expect(page.getByLabel("Street intersection map")).toBeHidden();
    await expect(article).toBeHidden();
    await expect(printReport).toBeVisible();
    await expect(printReport).toContainText(FIXTURE_1.displayName);
    await expect(printReport).toContainText("Complete report");
    await expectMetrics(printReport, FIXTURE_1.metrics);
    await expectSources(printReport);
  });

  test(`exact PRD §12 fixture numbers via real UI → real API → real Socrata — ${FIXTURE_2.caseName}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/");

    const target = await selectIntersectionByCoordinate(
      page,
      FIXTURE_2.latitude,
      FIXTURE_2.longitude,
    );
    await target.focus();
    await expect(page.locator(".map-status")).toContainText(
      FIXTURE_2.displayName,
    );
    await target.click();

    const panel = page.getByRole("complementary", {
      name: /safety report/i,
    });
    const liveRegion = panel.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText(`${FIXTURE_2.displayName} selected`);

    const { article, report } = await completeReport(page, panel);

    // Exact-value acceptance verification — no "greater than zero"
    // shortcuts. If live data has diverged from the documented PRD §12
    // fixture, these assertions fail loudly rather than being loosened.
    await assertReportMatchesFixture(report, FIXTURE_2);

    await expect(article).toContainText(FIXTURE_2.displayName);
    await expect(article).toContainText("Complete report");
    await expectMetrics(article, FIXTURE_2.metrics);
    await expectSources(article);

    // Fixture 2's documented, visible data-quality limitation.
    const limitationsSection = article.locator(
      "section[aria-labelledby='limitations-heading']",
    );
    await expect(limitationsSection).toContainText(
      "3 of 9 crash records are missing on_street_name.",
    );
    const notesSection = article.locator(
      "section[aria-labelledby='notes-heading']",
    );
    await expect(notesSection).toContainText(
      "The matched crash records had coordinates, so missing street labels do not change the coordinate-based counts.",
    );

    // Cheap DOM-only print check (no additional network round trip).
    await page.evaluate(() => {
      window.print = () => {
        document.documentElement.dataset.printCalled = "true";
      };
    });
    await panel.getByRole("button", { name: "Print or save as PDF" }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-print-called",
      "true",
    );
    const printReport = page.getByRole("article", {
      name: "Printable safety report",
      includeHidden: true,
    });
    await page.emulateMedia({ media: "print" });
    await expect(printReport).toBeVisible();
    await expect(printReport).toContainText(
      "3 of 9 crash records are missing on_street_name.",
    );
  });
});
