/**
 * Shared concerns for the Socrata (NYC Open Data) adapters.
 *
 * ## Failure-signalling contract
 *
 * The three adapters in this directory deliberately signal upstream failure
 * two different ways, and a new adapter MUST pick the one that matches what
 * its source means to the report:
 *
 * - **A source of truth THROWS.** If the report cannot truthfully exist
 *   without the source, the adapter throws a named error class and the route
 *   maps it to a 503 `source_failure`. `centerline.ts` is the only such
 *   source today: with no resolved intersection there is no report object to
 *   return.
 *
 * - **A degradable source RESOLVES TO A STATUS.** If the report is still
 *   truthful with the source missing — just less complete — the adapter never
 *   throws. It resolves to a discriminated result carrying an `unavailable`
 *   status, which `report.ts` turns into a 200 `partial` report plus a stated
 *   limitation. `collisions.ts` and `priority-zones.ts` both work this way.
 *
 * Picking "throw" for a degradable source is the dangerous mistake: it turns
 * a legitimate partial report into an uncaught 500 for the whole request.
 */

/**
 * Builds the Socrata request headers, attaching the app token when one is
 * provisioned. The token is optional — every adapter works without it at
 * demo volume and simply takes the stricter anonymous rate limit.
 *
 * `SOCRATA_APP_TOKEN` is server-only and must NEVER be given a
 * `NEXT_PUBLIC_` prefix, which would inline it into the client bundle.
 */
export function socrataHeaders(): HeadersInit | undefined {
  const token = process.env.SOCRATA_APP_TOKEN;
  return token ? { "X-App-Token": token } : undefined;
}
