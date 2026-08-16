# Security Policy

EZStreet is a hackathon project built over one weekend. It is small by design, and its security surface is correspondingly small.

## What the app does and does not handle

- **No user accounts, no authentication, no sessions.** There is nothing to log into.
- **No personal data is collected, stored, or transmitted.** The app has no database and no analytics. A selected intersection is held in browser memory for the length of the visit.
- **All data is public.** Every fact in a report comes from [NYC Open Data](https://opendata.cityofnewyork.us/), queried at request time. Nothing is persisted server-side.
- **One secret exists**: `SOCRATA_APP_TOKEN`, which raises NYC Open Data rate limits. It is optional — the app works without it. It is read only in server-side adapters and sent as an `X-App-Token` header. It must **never** be given a `NEXT_PUBLIC_` prefix, which would inline it into the client bundle.

## Reporting a vulnerability

Report privately through GitHub Security Advisories: [**Report a vulnerability**](https://github.com/hirekarl/ezstreet/security/advisories/new).

Please do not open a public issue for a security problem. We will acknowledge reports as quickly as we can, though note this is a hackathon project maintained by volunteers rather than a staffed service.

## Supported versions

Only the `main` branch and the current deployment at <https://ezstreet.vercel.app> are supported.
