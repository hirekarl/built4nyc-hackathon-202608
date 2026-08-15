import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
});

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
  await expect(liveRegion).toContainText("Partial report");

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
