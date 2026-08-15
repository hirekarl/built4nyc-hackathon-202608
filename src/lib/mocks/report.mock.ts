import type {
  IntersectionReport,
  IntersectionReportMetrics,
  IntersectionSelection,
  ReportSource,
} from "@/types/report";

const GENERATED_AT = "2026-08-15T16:00:00.000Z";
const RETRIEVED_AT = "2026-08-15T15:59:00.000Z";

const boundary = {
  kind: "circle",
  radiusMeters: 50,
} as const;

const period = {
  startInclusive: "2025-01-01",
  endExclusive: "2026-01-01",
} as const;

const w40At5AveSelection = {
  kind: "intersection",
  displayName: "W 40 ST at 5 AVE",
  coordinate: {
    latitude: 40.752205375223,
    longitude: -73.981823738617,
  },
  streetNames: ["W 40 ST", "5 AVE"],
  physicalIds: ["183093"],
} satisfies IntersectionSelection;

const e42AtParkAveSelection = {
  kind: "intersection",
  displayName: "E 42 ST at PARK AVE",
  coordinate: {
    latitude: 40.752175843845,
    longitude: -73.977792815236,
  },
  streetNames: ["E 42 ST", "PARK AVE"],
  physicalIds: ["73419", "148625"],
} satisfies IntersectionSelection;

const source = (
  name: string,
  datasetId: ReportSource["datasetId"],
  url: string,
  role: ReportSource["role"],
  queryDescription: string,
  retrievalStatus: ReportSource["retrievalStatus"] = "available",
): ReportSource => ({
  name,
  datasetId,
  url,
  role,
  queryDescription,
  retrievalStatus,
  retrievedAt: retrievalStatus === "available" ? RETRIEVED_AT : null,
});

const reportSources = ({
  collisionStatus = "available",
  priorityStatus = "unavailable",
}: {
  collisionStatus?: ReportSource["retrievalStatus"];
  priorityStatus?: ReportSource["retrievalStatus"];
} = {}): ReportSource[] => [
  source(
    "NYC Street Centerline",
    "inkn-q76z",
    "https://data.cityofnewyork.us/City-Government/Centerline/3mf9-qshr",
    "selection_geometry",
    "Eligible street geometry is loaded by map viewport.",
  ),
  source(
    "Motor Vehicle Collisions - Crashes",
    "h9gi-nx95",
    "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
    "collision_metrics",
    "Crash records are queried within 50 meters for calendar year 2025.",
    collisionStatus,
  ),
  source(
    "VZV Priority Zones or Areas",
    "qzji-nvbd",
    "https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd",
    "priority_context",
    "Five multipolygons are fetched and checked for boundary overlap.",
    priorityStatus,
  ),
];

const unavailableMetrics = {
  crashes: null,
  peopleInjured: null,
  peopleKilled: null,
  pedestriansInjured: null,
  pedestriansKilled: null,
  cyclistsInjured: null,
  cyclistsKilled: null,
  motoristsInjured: null,
  motoristsKilled: null,
  contributingFactors: null,
  unspecifiedFactors: null,
} satisfies IntersectionReportMetrics;

export const w40At5AveReportMock = {
  schemaVersion: "1",
  reportId: "report-w40-st-5-ave-2025",
  generatedAt: GENERATED_AT,
  status: "partial",
  selection: w40At5AveSelection,
  boundary,
  period,
  summary: "6 reported crashes matched this boundary and period.",
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
    contributingFactors: null,
    unspecifiedFactors: null,
  },
  priorityZone: {
    status: "unavailable",
  },
  limitations: [
    "Contributing-factor results are not available in the documented fixture.",
    "Priority Zone overlap is not available in the documented fixture.",
  ],
  notes: [
    "Collision metrics use the documented NYC Open Data acceptance fixture.",
  ],
  sources: reportSources(),
} satisfies IntersectionReport;

export const e42AtParkAveReportMock = {
  schemaVersion: "1",
  reportId: "report-e42-st-park-ave-2025",
  generatedAt: GENERATED_AT,
  status: "partial",
  selection: e42AtParkAveSelection,
  boundary,
  period,
  summary: "9 reported crashes matched this boundary and period.",
  metrics: {
    crashes: 9,
    peopleInjured: 4,
    peopleKilled: 0,
    pedestriansInjured: 2,
    pedestriansKilled: null,
    cyclistsInjured: 2,
    cyclistsKilled: null,
    motoristsInjured: null,
    motoristsKilled: null,
    contributingFactors: null,
    unspecifiedFactors: null,
  },
  priorityZone: {
    status: "unavailable",
  },
  limitations: [
    "3 of 9 crash records are missing on_street_name.",
    "Undocumented collision metrics are not available in the documented fixture.",
    "Priority Zone overlap is not available in the documented fixture.",
  ],
  notes: [
    "The matched crash records had coordinates, so missing street labels do not change the coordinate-based counts.",
  ],
  sources: reportSources(),
} satisfies IntersectionReport;

export const partialSourceReportMock = {
  schemaVersion: "1",
  reportId: "report-partial-source-2025",
  generatedAt: GENERATED_AT,
  status: "partial",
  selection: w40At5AveSelection,
  boundary,
  period,
  summary:
    "Crash metrics are unavailable because a required source could not be retrieved.",
  metrics: unavailableMetrics,
  priorityZone: {
    status: "unavailable",
  },
  limitations: [
    "Motor Vehicle Collisions - Crashes is unavailable, so collision metrics could not be computed.",
    "VZV Priority Zones or Areas is unavailable, so boundary overlap could not be checked.",
  ],
  notes: [],
  sources: reportSources({
    collisionStatus: "unavailable",
  }),
} satisfies IntersectionReport;

export const zeroMatchReportMock = {
  schemaVersion: "1",
  reportId: "report-zero-match-2025",
  generatedAt: GENERATED_AT,
  status: "partial",
  selection: w40At5AveSelection,
  boundary,
  period,
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
  priorityZone: {
    status: "unavailable",
  },
  limitations: [
    "Priority Zone overlap is not available in this mock scenario.",
  ],
  notes: ["Synthetic fixture for a successful zero-row collision response."],
  sources: reportSources(),
} satisfies IntersectionReport;
