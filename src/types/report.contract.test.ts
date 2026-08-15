import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  IntersectionReport,
  IntersectionReportErrorResponse,
  IntersectionReportRequest,
  IntersectionReportValidationErrorCode,
  PriorityZoneStatus,
  ReportSourceDatasetId,
  ReportSourceRole,
  ReportStatus,
  SourceRetrievalStatus,
} from "./report";

type ContractKeyTree<T> =
  NonNullable<T> extends readonly (infer Item)[]
    ? { "[]": ContractKeyTree<Item> }
    : NonNullable<T> extends object
      ? {
          [Key in keyof NonNullable<T>]-?: ContractKeyTree<NonNullable<T>[Key]>;
        }
      : true;

type RuntimeContractKeyTree =
  true | { readonly [key: string]: RuntimeContractKeyTree };

const REQUEST_KEY_TREE = {
  schemaVersion: true,
  selection: {
    kind: true,
    displayName: true,
    coordinate: {
      latitude: true,
      longitude: true,
    },
    streetNames: { "[]": true },
    physicalIds: { "[]": true },
  },
  boundary: {
    kind: true,
    radiusMeters: true,
  },
  period: {
    startInclusive: true,
    endExclusive: true,
  },
} as const satisfies ContractKeyTree<IntersectionReportRequest>;

const REPORT_KEY_TREE = {
  schemaVersion: true,
  selection: {
    kind: true,
    displayName: true,
    coordinate: {
      latitude: true,
      longitude: true,
    },
    streetNames: { "[]": true },
    physicalIds: { "[]": true },
  },
  boundary: {
    kind: true,
    radiusMeters: true,
  },
  period: {
    startInclusive: true,
    endExclusive: true,
  },
  reportId: true,
  generatedAt: true,
  status: true,
  summary: true,
  metrics: {
    crashes: true,
    peopleInjured: true,
    peopleKilled: true,
    pedestriansInjured: true,
    pedestriansKilled: true,
    cyclistsInjured: true,
    cyclistsKilled: true,
    motoristsInjured: true,
    motoristsKilled: true,
    contributingFactors: {
      "[]": {
        factor: true,
        count: true,
      },
    },
    unspecifiedFactors: true,
  },
  priorityZone: {
    status: true,
  },
  limitations: { "[]": true },
  notes: { "[]": true },
  sources: {
    "[]": {
      name: true,
      datasetId: true,
      url: true,
      role: true,
      retrievalStatus: true,
      retrievedAt: true,
      queryDescription: true,
    },
  },
} as const satisfies ContractKeyTree<IntersectionReport>;

const ERROR_KEY_TREE = {
  schemaVersion: true,
  error: {
    code: true,
    message: true,
    retryable: true,
  },
} as const satisfies ContractKeyTree<IntersectionReportErrorResponse>;

const VALIDATION_ERROR_CODES = [
  "invalid_request",
  "invalid_coordinate",
  "unsupported_radius",
  "unsupported_period",
  "unsupported_selection_kind",
  "raw_query_not_allowed",
  "intersection_not_found",
] as const;

const REPORT_STATUSES = ["complete", "partial"] as const;
const PRIORITY_STATUSES = ["matched", "not_matched", "unavailable"] as const;
const RETRIEVAL_STATUSES = ["available", "unavailable"] as const;
const SOURCE_ROLES = [
  "selection_geometry",
  "collision_metrics",
  "priority_context",
] as const;
const DATASET_IDS = ["inkn-q76z", "h9gi-nx95", "qzji-nvbd"] as const;

const CONTRACT_PATH = path.join(process.cwd(), "docs/contract.md");
const PRD_PATH = path.join(process.cwd(), "docs/prd.md");
const PLAN_PATH = path.join(
  process.cwd(),
  "docs/plans/ezstreet-implementation-plan.md",
);
const AGENTS_PATH = path.join(process.cwd(), "AGENTS.md");

const contractDocument = existsSync(CONTRACT_PATH)
  ? readFileSync(CONTRACT_PATH, "utf8")
  : "";
const prdDocument = readFileSync(PRD_PATH, "utf8");
const planDocument = readFileSync(PLAN_PATH, "utf8");
const agentsDocument = readFileSync(AGENTS_PATH, "utf8");

function flattenContractPaths(
  tree: RuntimeContractKeyTree,
  prefix = "",
): string[] {
  if (tree === true) return [prefix];

  return Object.entries(tree).flatMap(([key, child]) => {
    const nextPath =
      key === "[]" ? `${prefix}[]` : prefix ? `${prefix}.${key}` : key;
    return flattenContractPaths(child, nextPath);
  });
}

function expectLineWith(document: string, ...tokens: string[]) {
  const line = document
    .split("\n")
    .find((candidate) => tokens.every((token) => candidate.includes(token)));
  expect(
    line,
    `Expected one line containing: ${tokens.join(", ")}`,
  ).toBeDefined();
}

describe("frozen TypeScript report contract", () => {
  it("keeps every literal and enum exhaustive", () => {
    expectTypeOf<
      IntersectionReportRequest["schemaVersion"]
    >().toEqualTypeOf<"1">();
    expectTypeOf<
      IntersectionReportRequest["selection"]["kind"]
    >().toEqualTypeOf<"intersection">();
    expectTypeOf<
      IntersectionReportRequest["boundary"]["kind"]
    >().toEqualTypeOf<"circle">();
    expectTypeOf<
      IntersectionReportRequest["boundary"]["radiusMeters"]
    >().toEqualTypeOf<50>();
    expectTypeOf<
      IntersectionReportRequest["period"]["startInclusive"]
    >().toEqualTypeOf<"2025-01-01">();
    expectTypeOf<
      IntersectionReportRequest["period"]["endExclusive"]
    >().toEqualTypeOf<"2026-01-01">();
    expectTypeOf<
      (typeof REPORT_STATUSES)[number]
    >().toEqualTypeOf<ReportStatus>();
    expectTypeOf<
      (typeof PRIORITY_STATUSES)[number]
    >().toEqualTypeOf<PriorityZoneStatus>();
    expectTypeOf<
      (typeof RETRIEVAL_STATUSES)[number]
    >().toEqualTypeOf<SourceRetrievalStatus>();
    expectTypeOf<
      (typeof SOURCE_ROLES)[number]
    >().toEqualTypeOf<ReportSourceRole>();
    expectTypeOf<
      (typeof DATASET_IDS)[number]
    >().toEqualTypeOf<ReportSourceDatasetId>();
    expectTypeOf<
      (typeof VALIDATION_ERROR_CODES)[number]
    >().toEqualTypeOf<IntersectionReportValidationErrorCode>();
  });

  it("defines the exact discriminated error response without an HTTP status field", () => {
    type ValidationError = Extract<
      IntersectionReportErrorResponse,
      { error: { retryable: false } }
    >;
    type SourceFailure = Extract<
      IntersectionReportErrorResponse,
      { error: { retryable: true } }
    >;
    expectTypeOf<ValidationError["schemaVersion"]>().toEqualTypeOf<"1">();
    expectTypeOf<
      ValidationError["error"]["code"]
    >().toEqualTypeOf<IntersectionReportValidationErrorCode>();
    expectTypeOf<ValidationError["error"]["message"]>().toEqualTypeOf<string>();
    expectTypeOf<
      ValidationError["error"]["retryable"]
    >().toEqualTypeOf<false>();
    expectTypeOf<
      SourceFailure["error"]["code"]
    >().toEqualTypeOf<"source_failure">();
    expectTypeOf<SourceFailure["error"]["retryable"]>().toEqualTypeOf<true>();
  });
});

describe("canonical contract document", () => {
  it("publishes docs/contract.md", () => {
    expect(
      existsSync(CONTRACT_PATH),
      "Expected the canonical frontend contract at docs/contract.md",
    ).toBe(true);
  });

  it("documents every request, success, and error field path verbatim", () => {
    if (!contractDocument) return;

    const paths = [
      ...flattenContractPaths(REQUEST_KEY_TREE),
      ...flattenContractPaths(REPORT_KEY_TREE),
      ...flattenContractPaths(ERROR_KEY_TREE),
    ];

    for (const fieldPath of new Set(paths)) {
      expect(
        contractDocument,
        `Expected docs/contract.md to document ${fieldPath}`,
      ).toContain(fieldPath);
    }
    expect(contractDocument).toContain("sources[].datasetId");
    expect(contractDocument).toContain("metrics.contributingFactors[].factor");
  });

  it("documents the endpoint, locked server scope, coordinate order, enums, and real sources", () => {
    if (!contractDocument) return;

    expect(contractDocument).toContain("POST /api/reports/intersection");
    expectLineWith(contractDocument, "50", "server-authoritative");
    expectLineWith(
      contractDocument,
      "2025-01-01",
      "2026-01-01",
      "server-authoritative",
    );
    expectLineWith(contractDocument, "longitude", "latitude", "coordinate");
    expectLineWith(contractDocument, "untrusted", "revalidated");

    for (const literal of [
      '"1"',
      "intersection",
      "circle",
      ...REPORT_STATUSES,
      ...PRIORITY_STATUSES,
      ...RETRIEVAL_STATUSES,
      ...SOURCE_ROLES,
      ...DATASET_IDS,
      ...VALIDATION_ERROR_CODES,
      "source_failure",
    ]) {
      expect(
        contractDocument,
        `Expected documented literal ${literal}`,
      ).toContain(literal);
    }
  });

  it("defines null, zero, partial, degraded-source, and no-trustworthy-report semantics", () => {
    if (!contractDocument) return;

    expectLineWith(contractDocument, "null", "unavailable", "not", "zero");
    expectLineWith(contractDocument, "0", "successful", "zero");
    expectLineWith(
      contractDocument,
      "[]",
      "successful",
      "contributing factors",
    );
    expectLineWith(contractDocument, "partial", "HTTP 200");
    expectLineWith(contractDocument, "collision", "null");
    expectLineWith(contractDocument, "Priority", "unavailable");
    expectLineWith(contractDocument, "malformed", "null");
    expectLineWith(contractDocument, "multiple", "unavailable");
    expectLineWith(contractDocument, "503", "no trustworthy report object");
    expect(contractDocument).toMatch(
      /zero[\s\S]{0,100}(?:not|never)[\s\S]{0,40}safe/i,
    );
  });

  it("maps validation and source failures without leaking server details", () => {
    if (!contractDocument) return;

    for (const code of VALIDATION_ERROR_CODES) {
      expectLineWith(contractDocument, code, "400", "validation-error");
    }
    expectLineWith(contractDocument, "source_failure", "503", "source-failure");
    expectLineWith(contractDocument, "retryable", "false", "validation");
    expectLineWith(contractDocument, "retryable", "true", "source_failure");
    expectLineWith(contractDocument, "HTTP status", "not duplicated", "body");
    expectLineWith(contractDocument, "message", "user-safe");

    for (const forbiddenDetail of [
      "raw SoQL",
      "upstream response",
      "credentials",
      "stack trace",
    ]) {
      expectLineWith(contractDocument, "message", forbiddenDetail);
    }
  });

  it("keeps factual report fields deterministic and outside the AI boundary", () => {
    if (!contractDocument) return;

    expectLineWith(contractDocument, "AI", "never", "facts");
    expectLineWith(contractDocument, "deterministic", "metrics");
  });

  it("publishes the PRD section 9 field diff and panel-state mapping", () => {
    if (!contractDocument) return;

    expect(contractDocument).toMatch(/PRD (?:§|section )9 field diff/i);
    for (const mapping of [
      ["400", "validation-error"],
      ["503", "source-failure"],
      ["complete", "complete"],
      ["partial", "partial"],
    ]) {
      expectLineWith(contractDocument, ...mapping);
    }
  });
});

describe("contract source-of-truth cleanup", () => {
  it("makes PRD section 9 point to the canonical contract and removes the ownership decision", () => {
    const sectionNine =
      prdDocument.match(/## 9\. API contract([\s\S]*?)(?=\n## 10\.)/)?.[1] ??
      "";

    expect(sectionNine).toContain("docs/contract.md");
    expect(sectionNine).toMatch(/canonical/i);
    expect(prdDocument).not.toContain(
      "Team ownership for map, data/report service, report UI, and optional AI work.",
    );
  });

  it("marks only completed Phase 1 work and removes stale plan gates and references", () => {
    for (const step of [
      "1.1",
      "1.2",
      "1.4",
      "1.5",
      "1.6",
      "1.7",
      "1.8",
      "1.9",
    ]) {
      expect(
        planDocument,
        `Expected Phase 1 step ${step} to be checked`,
      ).toContain(`- [x] **${step}`);
    }
    expect(planDocument).toContain(
      "- [ ] **1.3 — SPIKE: Grand Central multi-roadbed node naming fallback**",
    );
    expect(planDocument).not.toContain(
      "- [x] **1.3 — SPIKE: Grand Central multi-roadbed node naming fallback**",
    );
    expect(planDocument).not.toMatch(/Gated on Phase 0/i);
    expect(planDocument).not.toContain("PRD §6.6 hierarchy");
    expect(planDocument).toContain("PRD §6.5 hierarchy");
    expectLineWith(planDocument, "Infra checkpoint", "non-blocking");
  });

  it("removes only the generated Next.js agent block from AGENTS.md", () => {
    expect(agentsDocument).not.toContain("<!-- BEGIN:nextjs-agent-rules -->");
    expect(agentsDocument).not.toContain("<!-- END:nextjs-agent-rules -->");
  });
});
