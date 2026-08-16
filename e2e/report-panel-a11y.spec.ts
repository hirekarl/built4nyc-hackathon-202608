import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { w40At5AveReportMock } from "../src/lib/mocks/report.mock";

const reportDrawerToggleName = /^(?:Collapse|Expand) safety report$/;

const officialCenterlineRows = [
  {
    physicalid: "183093",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "W  40 ST",
    street_name: "40",
    stname_label: "W 40 ST",
    b5sc: "134570",
    globalid: "22a224c4-07ad-4337-8b2a-d83f5dabe22a",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.981823738617, 40.752205375223],
          [-73.983459959877, 40.752894698732],
        ],
      ],
    },
  },
  {
    physicalid: "1941",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "5 AVE",
    street_name: "5",
    stname_label: "5 AVE",
    b5sc: "110410",
    globalid: "b030986f-7c3a-4cd1-875b-9b7fddca1f58",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.981823738617, 40.752205375223],
          [-73.98137279908, 40.75282210105],
        ],
      ],
    },
  },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/resource/inkn-q76z.json**", async (route) => {
    await route.fulfill({ json: officialCenterlineRows });
  });

  // This is a Phase 1 accessibility/layout spec, not a data-correctness
  // spec: it must stay deterministic and offline regardless of what NYC
  // Open Data returns live. Stub the server route itself (not just the
  // client-side map fetch above) so the whole page stays hermetic.
  // Live-data conformance is covered separately by Phase 3 Step 3.3/3.5.
  await page.route("**/api/reports/intersection", async (route) => {
    await route.fulfill({ json: w40At5AveReportMock });
  });
});

async function controlledDrawerBody(page: Page, toggle: Locator) {
  const bodyId = await toggle.getAttribute("aria-controls");
  expect(bodyId).toBeTruthy();
  return page.locator(`#${bodyId}`);
}

async function expectFullViewportMap(page: Page) {
  const mapBox = await page.getByLabel("Street intersection map").boundingBox();
  const viewport = page.viewportSize();
  expect(mapBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(mapBox?.x).toBeLessThanOrEqual(1);
  expect(mapBox?.y).toBeLessThanOrEqual(1);
  expect(mapBox?.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2);
  expect(mapBox?.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 2);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function expectBrandControlsGap(page: Page) {
  const brandBox = await page.locator(".map-brand-overlay").boundingBox();
  const controlsBox = await page
    .locator(".map-floating-controls")
    .boundingBox();

  expect(brandBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  expect(
    (controlsBox?.y ?? 0) - ((brandBox?.y ?? 0) + (brandBox?.height ?? 0)),
  ).toBeGreaterThanOrEqual(8);
}

test("composed map and report panel expose an accessible initial state", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "EZStreet" }),
  ).toBeVisible();
  await expect(page.getByLabel("Street intersection map")).toBeVisible();
  const panel = page.getByRole("complementary", { name: /safety report/i });
  await expect(panel).toBeVisible();

  const liveRegion = panel.locator('[aria-live="polite"]');
  await expect(liveRegion).toContainText(
    /select an intersection to create a safety report/i,
  );

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("desktop report drawer collapses without covering the map controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expectFullViewportMap(page);
  await expectBrandControlsGap(page);
  const panel = page.getByRole("complementary", { name: /safety report/i });
  const toggle = panel.getByRole("button", {
    name: reportDrawerToggleName,
  });
  const body = await controlledDrawerBody(page, toggle);
  const expandedBox = await panel.boundingBox();
  const viewport = page.viewportSize();

  expect(expandedBox).not.toBeNull();
  expect(expandedBox?.x).toBeGreaterThan((viewport?.width ?? 0) / 2);
  expect(expandedBox?.height).toBeLessThan((viewport?.height ?? 0) * 0.55);
  expect(
    (viewport?.width ?? 0) -
      ((expandedBox?.x ?? 0) + (expandedBox?.width ?? 0)),
  ).toBeLessThanOrEqual(32);
  await expect(toggle).toHaveAccessibleName("Collapse safety report");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(body).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAccessibleName("Expand safety report");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(body).toBeHidden();
  const collapsedBox = await panel.boundingBox();
  expect(collapsedBox).not.toBeNull();
  expect(collapsedBox?.height).toBeLessThan(expandedBox?.height ?? 0);
  await expectFullViewportMap(page);
  await expectNoHorizontalOverflow(page);

  const proxyToggle = page.getByRole("button", {
    name: "Choose an intersection without using the map",
  });
  await proxyToggle.focus();
  await expect(proxyToggle).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("mobile report drawer becomes a bounded collapsible bottom sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectFullViewportMap(page);
  await expectBrandControlsGap(page);
  const panel = page.getByRole("complementary", { name: /safety report/i });
  const toggle = panel.getByRole("button", {
    name: reportDrawerToggleName,
  });
  const body = await controlledDrawerBody(page, toggle);
  const expandedBox = await panel.boundingBox();
  const viewport = page.viewportSize();

  expect(expandedBox).not.toBeNull();
  expect(expandedBox?.x).toBeGreaterThanOrEqual(0);
  expect(expandedBox?.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(expandedBox?.y).toBeGreaterThan((viewport?.height ?? 0) * 0.4);
  expect(
    (viewport?.height ?? 0) -
      ((expandedBox?.y ?? 0) + (expandedBox?.height ?? 0)),
  ).toBeLessThanOrEqual(48);
  await expect(toggle).toHaveAccessibleName("Collapse safety report");
  await expect(body).toHaveCSS("overflow-y", /auto|scroll/);
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Expand safety report");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(body).toBeHidden();
  const collapsedBox = await panel.boundingBox();
  expect(collapsedBox).not.toBeNull();
  expect(collapsedBox?.height).toBeLessThan(expandedBox?.height ?? 0);
  await expectNoHorizontalOverflow(page);

  const proxyToggle = page.getByRole("button", {
    name: "Choose an intersection without using the map",
  });
  await proxyToggle.focus();
  await expect(proxyToggle).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keyboard proxy selects an intersection and print media preserves the report", async ({
  page,
}) => {
  await page.goto("/");

  const proxyToggle = page.getByRole("button", {
    name: "Choose an intersection without using the map",
  });
  await proxyToggle.focus();
  await page.keyboard.press("Enter");
  await expect(proxyToggle).toHaveAttribute("aria-expanded", "true");

  const intersection = page.getByRole("button", {
    name: /W 40 ST at 5 AVE.*40\.752205.*-73\.981824/i,
  });
  await intersection.focus();
  await page.keyboard.press("Enter");
  await expect(intersection).toHaveAttribute("aria-pressed", "true");

  const panel = page.getByRole("complementary", { name: /safety report/i });
  const liveRegion = panel.locator('[aria-live="polite"]');
  await expect(liveRegion).toContainText("W 40 ST at 5 AVE");

  const generate = panel.getByRole("button", {
    name: "Generate safety report",
  });
  await generate.focus();
  await page.keyboard.press("Enter");
  await expect(liveRegion).toContainText("Retrieving NYC Open Data");

  const drawerToggle = panel.getByRole("button", {
    name: reportDrawerToggleName,
  });
  const drawerBody = await controlledDrawerBody(page, drawerToggle);
  await expect(drawerToggle).toHaveAccessibleName("Collapse safety report");
  await drawerToggle.click();
  await expect(drawerToggle).toHaveAccessibleName("Expand safety report");
  await expect(drawerToggle).toHaveAttribute("aria-expanded", "false");
  await expect(drawerBody).toBeHidden();
  await expect(liveRegion).toContainText("Partial report");
  await expect(drawerToggle).toHaveAttribute("aria-expanded", "false");

  await drawerToggle.click();
  await expect(drawerToggle).toHaveAccessibleName("Collapse safety report");
  await expect(drawerToggle).toHaveAttribute("aria-expanded", "true");
  await expect(drawerBody).toBeVisible();

  const screenReport = page.getByRole("article", {
    name: "On-screen safety report",
  });
  const printReport = page.getByRole("article", {
    name: "Printable safety report",
    includeHidden: true,
  });
  await expect(screenReport).toContainText("W 40 ST at 5 AVE");
  await expect(screenReport).toContainText("6");
  await expect(printReport).toBeHidden();

  const longPanelBox = await panel.boundingBox();
  const viewport = page.viewportSize();
  const scrollState = await drawerBody.evaluate((body) => ({
    clientHeight: body.clientHeight,
    overflowY: window.getComputedStyle(body).overflowY,
    scrollHeight: body.scrollHeight,
  }));
  expect(longPanelBox).not.toBeNull();
  expect((longPanelBox?.y ?? 0) + (longPanelBox?.height ?? 0)).toBeLessThan(
    viewport?.height ?? 0,
  );
  expect(scrollState.overflowY).toMatch(/auto|scroll/);
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);

  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = "true";
    };
  });
  const printButton = panel.getByRole("button", {
    name: "Print or save as PDF",
  });
  await printButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute(
    "data-print-called",
    "true",
  );

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByLabel("Street intersection map")).toBeHidden();
  await expect(printButton).toBeHidden();
  await expect(screenReport).toBeHidden();
  await expect(printReport).toBeVisible();
  await expect(printReport).toContainText("W 40 ST at 5 AVE");
  await expect(printReport).toContainText("Partial report");
  await expect(printReport).toContainText("6");
  await expect(printReport).toContainText("h9gi-nx95");
});
