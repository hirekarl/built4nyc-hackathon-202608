import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import type {
  IntersectionReport,
  IntersectionReportBoundary,
  IntersectionReportErrorResponse,
  IntersectionReportPeriod,
  IntersectionReportRequest,
  IntersectionSelection,
} from "../types/report";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}));

vi.mock("../components/Map", () => ({
  default: ({
    onSelect,
  }: {
    onSelect: (selection: IntersectionSelection) => void;
  }) => (
    <div aria-label="Mock intersection map">
      <button
        type="button"
        onClick={() =>
          onSelect({
            kind: "intersection",
            displayName: "W 40 ST at 5 AVE",
            coordinate: {
              latitude: 40.752205375223,
              longitude: -73.981823738617,
            },
            streetNames: ["W 40 ST", "5 AVE"],
            physicalIds: ["183093", "1941"],
          })
        }
      >
        Select W 40 ST at 5 AVE
      </button>
      <button
        type="button"
        onClick={() =>
          onSelect({
            kind: "intersection",
            displayName: "E 42 ST at PARK AVE",
            coordinate: {
              latitude: 40.752175843845,
              longitude: -73.977792815236,
            },
            streetNames: ["E 42 ST", "PARK AVE"],
            physicalIds: ["73419", "148625"],
          })
        }
      >
        Select E 42 ST at PARK AVE
      </button>
    </div>
  ),
}));

function selectIntersection(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function clickGenerate() {
  fireEvent.click(
    screen.getByRole("button", { name: /generate safety report/i }),
  );
}

function expectMetric(label: string, value: string | number) {
  const term = screen.getByText(label, { selector: "dt" });
  expect(term.nextElementSibling).toHaveTextContent(String(value));
}

const W40_SELECTION: IntersectionSelection = {
  kind: "intersection",
  displayName: "W 40 ST at 5 AVE",
  coordinate: { latitude: 40.752205375223, longitude: -73.981823738617 },
  streetNames: ["W 40 ST", "5 AVE"],
  physicalIds: ["183093", "1941"],
};

const CONTRACT_BOUNDARY: IntersectionReportBoundary = {
  kind: "circle",
  radiusMeters: 50,
};

const CONTRACT_PERIOD: IntersectionReportPeriod = {
  startInclusive: "2025-01-01",
  endExclusive: "2026-01-01",
};

function expectedRequestBody(
  selection: IntersectionSelection,
): IntersectionReportRequest {
  return {
    schemaVersion: "1",
    selection,
    boundary: CONTRACT_BOUNDARY,
    period: CONTRACT_PERIOD,
  };
}

function buildSuccessBody(
  selection: IntersectionSelection,
  overrides: Partial<IntersectionReport> = {},
): IntersectionReport {
  return {
    schemaVersion: "1",
    reportId: "report-test-1",
    generatedAt: "2026-08-15T16:00:00.000Z",
    status: "complete",
    summary: "6 reported crashes matched this boundary and period.",
    selection,
    boundary: CONTRACT_BOUNDARY,
    period: CONTRACT_PERIOD,
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
      contributingFactors: [{ factor: "Driver Inattention", count: 3 }],
      unspecifiedFactors: 1,
    },
    priorityZone: { status: "matched" },
    limitations: [],
    notes: [],
    sources: [
      {
        name: "NYC Street Centerline",
        datasetId: "inkn-q76z",
        url: "https://data.cityofnewyork.us/City-Government/Centerline/3mf9-qshr",
        role: "selection_geometry",
        retrievalStatus: "available",
        retrievedAt: "2026-08-15T15:59:00.000Z",
        queryDescription: "Eligible street geometry is loaded by map viewport.",
      },
      {
        name: "Motor Vehicle Collisions - Crashes",
        datasetId: "h9gi-nx95",
        url: "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
        role: "collision_metrics",
        retrievalStatus: "available",
        retrievedAt: "2026-08-15T15:59:00.000Z",
        queryDescription:
          "Crash records are queried within 50 meters for calendar year 2025.",
      },
      {
        name: "VZV Priority Zones or Areas",
        datasetId: "qzji-nvbd",
        url: "https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd",
        role: "priority_context",
        retrievalStatus: "available",
        retrievedAt: "2026-08-15T15:59:00.000Z",
        queryDescription:
          "Five multipolygons are fetched and checked for boundary overlap.",
      },
    ],
    ...overrides,
  };
}

function buildErrorBody(
  code: IntersectionReportErrorResponse["error"]["code"],
  message: string,
  retryable: boolean,
): IntersectionReportErrorResponse {
  return {
    schemaVersion: "1",
    error: { code, message, retryable },
  } as IntersectionReportErrorResponse;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

interface DeferredResponse {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
  reject: (reason?: unknown) => void;
}

function deferredResponse(): DeferredResponse {
  let resolve!: (response: Response) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Home", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the app name as the main heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "EZStreet" }),
    ).toBeInTheDocument();
  });

  it("describes what the app does", () => {
    render(<Home />);
    expect(
      screen.getByText(/deterministic street-safety report/i),
    ).toBeInTheDocument();
  });

  it("exposes a full-viewport map workspace with a compact brand overlay", () => {
    render(<Home />);

    const heading = screen.getByRole("heading", { level: 1, name: "EZStreet" });
    const workspace = heading.closest("main");
    const brand = heading.closest("header");
    const map = screen.getByLabelText("Mock intersection map");

    expect(workspace).toHaveClass("map-workspace");
    expect(brand).toHaveClass("map-brand-overlay");
    expect(map.closest(".map-canvas-shell")).toBeInTheDocument();
    expect(workspace).not.toHaveClass("app-shell");
  });

  it("moves from initial to ready when the map selects an official intersection", () => {
    render(<Home />);

    selectIntersection(/select W 40 ST at 5 AVE/i);

    expect(screen.getByText("W 40 ST at 5 AVE")).toBeInTheDocument();
    expect(screen.getByText("50 meters (about 164 feet)")).toBeInTheDocument();
    expect(screen.getByText("Calendar year 2025")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate safety report/i }),
    ).toBeEnabled();
  });

  it("posts the locked selection, server-owned boundary, and period to /api/reports/intersection, then renders the real fetched report through loading", async () => {
    const deferred = deferredResponse();
    fetchMock.mockReturnValueOnce(deferred.promise);

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/reports/intersection");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init.body))).toEqual(
      expectedRequestBody(W40_SELECTION),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /retrieving NYC Open Data/i,
    );

    await act(async () => {
      deferred.resolve(jsonResponse(buildSuccessBody(W40_SELECTION)));
    });

    expect(await screen.findByText("Complete report")).toBeInTheDocument();
    expectMetric("Crashes", 6);
    expectMetric("People injured", 7);
  });

  it("surfaces the validation-error panel state (not a crash) for a 400 response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildErrorBody(
          "intersection_not_found",
          "This selection could not be resolved to an eligible intersection.",
          false,
        ),
        400,
      ),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be analyzed/i,
    );
    expect(
      screen.queryByText(/reported crashes matched/i),
    ).not.toBeInTheDocument();
  });

  it("surfaces the source-failure panel state for a 503 source_failure response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildErrorBody(
          "source_failure",
          "Required NYC Open Data sources could not be retrieved.",
          true,
        ),
        503,
      ),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /required data could not be loaded/i,
    );
  });

  it("surfaces the partial panel state for a status: partial success response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildSuccessBody(W40_SELECTION, {
          status: "partial",
          summary: "6 reported crashes matched this boundary and period.",
          limitations: [
            "Priority Zone overlap is not available in this fixture.",
          ],
        }),
      ),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Partial report")).toBeInTheDocument();
    expectMetric("Crashes", 6);
  });

  it("surfaces the zero-match panel state for metrics.crashes: 0", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildSuccessBody(W40_SELECTION, {
          status: "partial",
          summary: "No reported crashes matched this boundary and period.",
          metrics: {
            crashes: 0,
            peopleInjured: 0,
            peopleKilled: 0,
            pedestriansInjured: 0,
            pedestriansKilled: 0,
            cyclistsInjured: 0,
            cyclistsKilled: 0,
            motoristsInjured: 0,
            motoristsKilled: 0,
            contributingFactors: [],
            unspecifiedFactors: 0,
          },
        }),
      ),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("No crash matches for this boundary and period."),
    ).toBeInTheDocument();
  });

  it("surfaces the source-failure panel state when fetch itself rejects (network error), not an unhandled crash", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /required data could not be loaded/i,
    );
  });

  it("ignores a late-arriving response for a superseded selection (stale-response race)", async () => {
    const staleDeferred = deferredResponse();
    fetchMock.mockReturnValueOnce(staleDeferred.promise);

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(/retrieving/i);

    // Reselect a different intersection while the first request is still in flight.
    selectIntersection(/select E 42 ST at PARK AVE/i);
    expect(screen.getByText("E 42 ST at PARK AVE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate safety report/i }),
    ).toBeEnabled();

    // The stale request for W 40 ST now resolves — it must not overwrite the
    // panel now showing the newer E 42 ST at PARK AVE selection.
    await act(async () => {
      staleDeferred.resolve(jsonResponse(buildSuccessBody(W40_SELECTION)));
    });

    expect(screen.queryByText("Complete report")).not.toBeInTheDocument();
    expect(screen.queryByText("Partial report")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/reported crashes matched this boundary and period/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("E 42 ST at PARK AVE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate safety report/i }),
    ).toBeEnabled();
  });

  it("aborts the in-flight fetch when a newer selection supersedes it, and stays silent when the aborted request later rejects", async () => {
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        }),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(false);

    // Reselecting mid-flight must actually abort the superseded request, not
    // just discard its eventual result.
    selectIntersection(/select E 42 ST at PARK AVE/i);
    expect(init.signal?.aborted).toBe(true);

    // Let the aborted fetch's rejection settle — it must not surface
    // source-failure for a request the user already moved on from.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("E 42 ST at PARK AVE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate safety report/i }),
    ).toBeEnabled();
  });

  it("surfaces the source-failure panel state when the request exceeds the fetch timeout", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted.", "TimeoutError"),
              );
            });
          }),
      );

      render(<Home />);
      selectIntersection(/select W 40 ST at 5 AVE/i);
      clickGenerate();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent(/retrieving/i);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        /required data could not be loaded/i,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the in-flight fetch on unmount instead of leaving it running", async () => {
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        }),
    );

    const { unmount } = render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(false);

    unmount();
    expect(init.signal?.aborted).toBe(true);

    // The rejected fetch settling after unmount must not attempt to update
    // state on the unmounted tree.
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("ignores a late-arriving response after the selection has been cleared", async () => {
    const deferred = deferredResponse();
    fetchMock.mockReturnValueOnce(deferred.promise);

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(/retrieving/i);

    fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(
      screen.getByText(/select an intersection to create a safety report/i),
    ).toBeInTheDocument();

    await act(async () => {
      deferred.resolve(jsonResponse(buildSuccessBody(W40_SELECTION)));
    });

    expect(screen.queryByText("Complete report")).not.toBeInTheDocument();
    expect(
      screen.getByText(/select an intersection to create a safety report/i),
    ).toBeInTheDocument();
  });

  it("supports retry after a source failure by re-issuing the fetch", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildErrorBody(
          "source_failure",
          "Required NYC Open Data sources could not be retrieved.",
          true,
        ),
        503,
      ),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(buildSuccessBody(W40_SELECTION)),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /required data could not be loaded/i,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Complete report")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the current selection and report state after a successful report", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(buildSuccessBody(W40_SELECTION)),
    );

    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    clickGenerate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Complete report")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));

    expect(screen.queryByText("W 40 ST at 5 AVE")).not.toBeInTheDocument();
    expect(
      screen.getByText(/select an intersection to create a safety report/i),
    ).toBeInTheDocument();
  });
});

describe("layout metadata", () => {
  it("does not reference the deprecated petition pitch", () => {
    // layout.tsx isn't imported directly here because it loads next/font/google,
    // which isn't transformable outside the Next.js build pipeline in vitest.
    const layoutSource = readFileSync(
      path.join(import.meta.dirname, "layout.tsx"),
      "utf-8",
    );
    expect(layoutSource).not.toMatch(/petition/i);
  });

  it("exports the report metadata and renders the root layout", async () => {
    const { default: RootLayout, metadata } = await import("./layout");
    const layout = RootLayout({
      children: <span>Report content</span>,
    } as Parameters<typeof RootLayout>[0]);

    expect(metadata).toMatchObject({
      title: "EZStreet",
      description: expect.stringMatching(/street-safety report/i),
    });
    expect(layout).toMatchObject({
      type: "html",
      props: {
        lang: "en",
        className: expect.stringContaining("font-geist-sans"),
      },
    });
    expect(layout.props.children.props.className).toContain("min-h-full");
  });
});
