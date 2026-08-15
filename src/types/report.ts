export type ReportStatus = "complete" | "partial";

export type PriorityZoneStatus = "matched" | "not_matched" | "unavailable";

export type SourceRetrievalStatus = "available" | "unavailable";

export type ReportSourceRole =
  "selection_geometry" | "collision_metrics" | "priority_context";

export type ReportSourceDatasetId = "inkn-q76z" | "h9gi-nx95" | "qzji-nvbd";

export type IntersectionReportValidationErrorCode =
  | "invalid_request"
  | "invalid_coordinate"
  | "unsupported_radius"
  | "unsupported_period"
  | "unsupported_selection_kind"
  | "raw_query_not_allowed"
  | "intersection_not_found";

export interface IntersectionSelection {
  kind: "intersection";
  displayName: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  streetNames: string[];
  physicalIds: string[];
}

export interface IntersectionReportBoundary {
  kind: "circle";
  radiusMeters: 50;
}

export interface IntersectionReportPeriod {
  startInclusive: "2025-01-01";
  endExclusive: "2026-01-01";
}

export interface IntersectionReportRequest {
  schemaVersion: "1";
  selection: IntersectionSelection;
  boundary: IntersectionReportBoundary;
  period: IntersectionReportPeriod;
}

export interface ContributingFactorMetric {
  factor: string;
  count: number;
}

export interface IntersectionReportMetrics {
  crashes: number | null;
  peopleInjured: number | null;
  peopleKilled: number | null;
  pedestriansInjured: number | null;
  pedestriansKilled: number | null;
  cyclistsInjured: number | null;
  cyclistsKilled: number | null;
  motoristsInjured: number | null;
  motoristsKilled: number | null;
  contributingFactors: ContributingFactorMetric[] | null;
  unspecifiedFactors: number | null;
}

export interface PriorityZoneResult {
  status: PriorityZoneStatus;
}

export interface ReportSource {
  name: string;
  datasetId: ReportSourceDatasetId;
  url: string;
  role: ReportSourceRole;
  retrievalStatus: SourceRetrievalStatus;
  retrievedAt: string | null;
  queryDescription: string;
}

export interface IntersectionReport extends IntersectionReportRequest {
  reportId: string;
  generatedAt: string;
  status: ReportStatus;
  summary: string;
  metrics: IntersectionReportMetrics;
  priorityZone: PriorityZoneResult;
  limitations: string[];
  notes: string[];
  sources: ReportSource[];
}

export type IntersectionReportErrorResponse =
  | {
      schemaVersion: "1";
      error: {
        code: IntersectionReportValidationErrorCode;
        message: string;
        retryable: false;
      };
    }
  | {
      schemaVersion: "1";
      error: {
        code: "source_failure";
        message: string;
        retryable: true;
      };
    };
