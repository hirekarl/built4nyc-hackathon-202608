import { readFileSync } from "node:fs";
import path from "node:path";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}));

vi.mock("../components/Map", () => ({
  default: ({
    onSelect,
  }: {
    onSelect: (selection: {
      kind: "intersection";
      displayName: string;
      coordinate: { latitude: number; longitude: number };
      streetNames: string[];
      physicalIds: string[];
    }) => void;
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
      <button
        type="button"
        onClick={() =>
          onSelect({
            kind: "intersection",
            displayName: "UNKNOWN ST at FIXTURE AVE",
            coordinate: { latitude: 40.7, longitude: -73.9 },
            streetNames: ["UNKNOWN ST", "FIXTURE AVE"],
            physicalIds: ["unknown"],
          })
        }
      >
        Select unknown intersection
      </button>
    </div>
  ),
}));

function selectIntersection(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function expectMetric(label: string, value: string | number) {
  const term = screen.getByText(label, { selector: "dt" });
  expect(term.nextElementSibling).toHaveTextContent(String(value));
}

describe("Home", () => {
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

  it("shows a visible loading transition before the coordinate-matched report", async () => {
    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);

    fireEvent.click(
      screen.getByRole("button", { name: /generate safety report/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /retrieving NYC Open Data/i,
    );
    expect(await screen.findByText("Partial report")).toBeInTheDocument();
    expectMetric("Crashes", 6);
    expectMetric("People injured", 7);
  });

  it("uses only the report whose locked coordinate matches the selection", async () => {
    render(<Home />);
    selectIntersection(/select E 42 ST at PARK AVE/i);
    fireEvent.click(
      screen.getByRole("button", { name: /generate safety report/i }),
    );

    expect(await screen.findByText("Partial report")).toBeInTheDocument();
    expectMetric("Crashes", 9);
    expectMetric("People injured", 4);
    expect(
      screen.queryByText(
        "6 reported crashes matched this boundary and period.",
      ),
    ).not.toBeInTheDocument();
  });

  it("fails honestly for an unknown coordinate and supports retry", async () => {
    render(<Home />);
    selectIntersection(/select unknown intersection/i);
    fireEvent.click(
      screen.getByRole("button", { name: /generate safety report/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /required data could not be loaded/i,
    );
    expect(
      screen.queryByText(/reported crashes matched/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByRole("status")).toHaveTextContent(
      /retrieving NYC Open Data/i,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /required data could not be loaded/i,
      ),
    );
  });

  it("clears the current selection and report state", async () => {
    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    fireEvent.click(
      screen.getByRole("button", { name: /generate safety report/i }),
    );
    expect(await screen.findByText("Partial report")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));

    expect(screen.queryByText("W 40 ST at 5 AVE")).not.toBeInTheDocument();
    expect(
      screen.getByText(/select an intersection to create a safety report/i),
    ).toBeInTheDocument();
  });

  it("removes a stale report immediately when a new intersection is selected", async () => {
    render(<Home />);
    selectIntersection(/select W 40 ST at 5 AVE/i);
    fireEvent.click(
      screen.getByRole("button", { name: /generate safety report/i }),
    );
    expect(await screen.findByText("Partial report")).toBeInTheDocument();
    expectMetric("Crashes", 6);

    selectIntersection(/select E 42 ST at PARK AVE/i);

    expect(screen.queryByText("Partial report")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "6 reported crashes matched this boundary and period.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("E 42 ST at PARK AVE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate safety report/i }),
    ).toBeEnabled();
  });

  it("replaces a selection while its report timer is pending", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi
      .spyOn(globalThis, "clearTimeout")
      .mockImplementation(() => undefined);
    try {
      render(<Home />);
      selectIntersection(/select W 40 ST at 5 AVE/i);
      fireEvent.click(
        screen.getByRole("button", { name: /generate safety report/i }),
      );
      expect(screen.getByRole("status")).toHaveTextContent(/retrieving/i);

      selectIntersection(/select E 42 ST at PARK AVE/i);
      act(() => vi.runAllTimers());

      expect(screen.getByText("E 42 ST at PARK AVE")).toBeInTheDocument();
      expect(screen.queryByText("Partial report")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /generate safety report/i }),
      ).toBeEnabled();
    } finally {
      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("clears a selection while its report timer is pending", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      selectIntersection(/select W 40 ST at 5 AVE/i);
      fireEvent.click(
        screen.getByRole("button", { name: /generate safety report/i }),
      );
      expect(screen.getByRole("status")).toHaveTextContent(/retrieving/i);

      fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));
      act(() => vi.runAllTimers());

      expect(
        screen.getByText(/select an intersection to create a safety report/i),
      ).toBeInTheDocument();
      expect(screen.queryByText("Partial report")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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
