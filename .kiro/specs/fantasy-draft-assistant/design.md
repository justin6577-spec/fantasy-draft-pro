# Design Document

## Overview

Fantasy Draft Assistant is a mobile-first app (iOS + Android) built around one hard real-time problem (live draft sync) and three supporting features (AI recommendations, news summaries, subscriptions). The design below assumes a single cross-platform mobile client talking to a central backend that owns the "source of truth" for every draft, whether that draft is native to the app or mirrored from an external platform (Yahoo, ESPN, Sleeper).

**Assumed stack (not yet confirmed with you — flagged for review):**

| Layer | Choice | Why |
|---|---|---|
| Mobile client | React Native + TypeScript (Expo) | One codebase for iOS/Android, fastest path to a draft-day-ready app, huge ecosystem for websockets/push |
| Backend API | Node.js + TypeScript (NestJS or Fastify) | Same language as client, strong websocket support, easy to hire for |
| Real-time transport | WebSocket via Socket.IO (or native `ws` + a room abstraction) | Needed for sub-1s draft pick propagation (Requirement 3.1) |
| Database | PostgreSQL | Relational data (users, leagues, rosters, picks) with strong consistency guarantees needed for draft pick conflicts |
| Cache / pub-sub | Redis | Draft clock state, pub/sub fan-out across backend instances, rate limiting |
| Background jobs | Redis-backed queue (BullMQ) | Polling external platforms, news ingestion, notification delivery |
| AI provider | OpenAI (GPT-4-class) via server-side proxy | Recommendation reasoning + news summarization; never called directly from the client (key security + cost control) |
| Push notifications | Firebase Cloud Messaging (Android) + APNs (iOS), unified via FCM or Expo Notifications | Turn alerts, news alerts, subscription reminders |
| Subscriptions/billing | RevenueCat wrapping App Store / Google Play billing | Cross-platform entitlement sync (Req 4.2), avoids handling raw payment data (Req 4.6) |
| Hosting | Any container platform (Fly.io, Render, AWS ECS) with a managed Postgres + Redis | Needs sticky/room-aware websocket routing if scaled beyond one instance |

If you already have a preferred stack, tell me and I'll adjust this document before we move to tasks.

## Architecture

```
                         ┌─────────────────────────┐
                         │      Mobile App          │
                         │  (React Native / Expo)   │
                         │                           │
                         │  - Draft Room UI          │
                         │  - Player DB / News UI    │
                         │  - Subscription paywall   │
                         └────────────┬──────────────┘
                                      │ REST (queries) + WebSocket (draft state)
                                      ▼
                         ┌─────────────────────────┐
                         │        API Gateway        │
                         │  (Auth, rate limit, TLS)  │
                         └────────────┬──────────────┘
                                      │
        ┌─────────────────┬──────────┼──────────────┬────────────────────┐
        ▼                 ▼          ▼              ▼                    ▼
 ┌─────────────┐  ┌──────────────┐ ┌───────────────┐ ┌────────────────┐ ┌──────────────┐
 │ Draft Room  │  │ Recommendation│ │ News Ingestion │ │ Subscription   │ │ League Sync   │
 │ Service     │  │ Service        │ │ & Summarizer   │ │ Service        │ │ Service       │
 │ (WS + REST) │  │ (calls LLM)    │ │ (calls LLM)    │ │ (RevenueCat    │ │ (Yahoo OAuth, │
 │             │  │                │ │                │ │  webhooks)     │ │  Sleeper poll,│
 │             │  │                │ │                │ │                │ │  ESPN cookies)│
 └──────┬──────┘  └───────┬───────┘ └───────┬────────┘ └────────┬───────┘ └──────┬───────┘
        │                 │                 │                   │                │
        └────────┬────────┴────────┬────────┴─────────┬─────────┴────────┬───────┘
                  ▼                 ▼                  ▼                  ▼
           ┌────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │  Postgres   │   │    Redis      │   │  Job Queue    │   │ External APIs │
           │ (system of  │   │ (draft state, │   │ (BullMQ)      │   │ Yahoo/Sleeper/│
           │  record)    │   │  pub/sub)     │   │               │   │ ESPN/News/LLM │
           └────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

Each backend "service" can start as a module in one deployable and be split out later; nothing above requires microservices on day one.

## Components and Interfaces

### 1. Draft Room Service (native live draft)

Owns the authoritative draft state machine for drafts hosted inside the app.

- **State model**: `Draft { id, leagueId, order[], currentPickIndex, clockSecondsRemaining, status, settings }`, `Pick { draftId, pickIndex, teamId, playerId, madeAt, source(manual|auto|skip) }`.
- **Transport and authorization**: Clients present an access JWT during the Socket.IO handshake, then join room `draft:{draftId}` only if a `DraftParticipant` row maps the authenticated user to a team in that draft. The server emits `draft.identity` with that authoritative team ID, plus `pick.made`, `clock.tick`, `turn.changed`, and `draft.completed`. `pick.submit` contains no trusted team identity; the server derives `teamId` from `DraftParticipant` on every pick, preventing client-side team impersonation.
- **Conflict resolution (Req 3.8)**: `pick.submit` is handled by a single Postgres transaction with `SELECT ... FOR UPDATE` on the draft row (or a Redis lock keyed by `draftId`) so two simultaneous submissions for the same player/slot are serialized. The loser gets an immediate `pick.rejected` event with a reason and the current authoritative state, prompting the client to re-render instantly rather than retry blindly.
- **Reconnection (Req 3.3)**: On socket connect, client sends `lastKnownPickIndex`; server always responds with a full state snapshot + event log since that index, so the client can reconcile instead of assuming it's caught up.
- **Clock (Req 3.4/3.5)**: A server-side timer per active draft (backed by Redis keys with TTL, not in-process `setTimeout`, so it survives a service restart/redeploy) ticks down and, on expiry, either autopicks (best available from the user's queue/rankings) or skips per league settings, then emits `turn.changed`.

### 2. League Sync Service (external platform mirroring)

Bridges Yahoo, Sleeper, and ESPN drafts into the same client-facing event model as the native Draft Room Service, so the UI doesn't need to know which platform a draft came from.

- **Sleeper**: Public, unauthenticated, read-only REST API (no official push/webhook mechanism). Sync is implemented as short-interval polling (every 2-3s during an active draft) of the league/draft endpoints, diffed against last-known state, re-emitted as the same `pick.made`/`turn.changed` events over the app's own websocket room. This satisfies "near real time" (Req 3.6) but cannot hit true sub-1s guarantees — that guarantee (Req 3.1) applies to native drafts only, and the UI should visually distinguish "synced from Sleeper" drafts with a brief "last synced Xs ago" indicator so expectations stay honest.
- **Yahoo**: Official OAuth 2.0 Fantasy Sports API. Requires registering a Yahoo Developer app and doing a 3-legged OAuth flow per user (Req 5.2). No push mechanism either, so this is also polling-based, on a similar cadence.
- **ESPN**: No official public API. Third-party libraries authenticate private leagues using two session values scraped from an authenticated browser session (`SWID` and `espn_s2` cookies), which is unofficial, against the spirit of typical ToS, and fragile to ESPN changing their auth. Recommendation: ship Yahoo + Sleeper first, treat ESPN as a stretch/opt-in integration, and clearly disclose to users that ESPN sync uses an unofficial method that may break without notice. I'd like your explicit sign-off before we build against ESPN given that risk.
- All external tokens/cookies are encrypted at rest and tied to the user's account; expiry triggers a re-auth prompt (Req 5.3) rather than a silent failure.

### 3. Recommendation Service (AI draft recommendations)

- **Inputs per request**: current draft state (roster needs, pick number, players taken), league scoring settings, a base statistical ranking/projection set (not solely LLM-generated — the LLM reasons over real projections, it doesn't invent them), and the user's queue/preferences.
- **Two-tier design**:
  1. A deterministic ranking engine (value-based drafting / positional scarcity math) computes a numeric best-available list. This is what powers autopick and the fallback path (Req 1.6) — it never depends on the LLM being up.
  2. The LLM is layered on top only to produce the natural-language "why" (Req 1.3) and to do soft re-ranking for nuanced context (bye weeks, injury risk tolerance), always constrained to the candidate list the deterministic engine already produced — this avoids the model hallucinating a player who isn't actually available.
- **Caching**: Recommendations for a given draft state are cached (keyed by draft state hash) for a few seconds since many users hit the same "who's the best RB left" question during a live draft.
- **Freshness (Req 1.5)**: Ranking inputs are refreshed from the news/injury pipeline on a schedule (target: within 5 minutes of ingested news), not recomputed from scratch on every request.

### 4. News Ingestion & Summarizer Service

- **Ingestion**: A scheduled worker pulls from a licensed sports data/news provider (needs to be selected — see Open Questions) on a polling cadence, deduplicates by source+timestamp, and stores raw articles linked to player IDs.
- **Summarization**: An LLM call converts raw article(s) into: a short prose summary, a fantasy-impact tag (`Out`, `Questionable`, `Role Change`, `Neutral`, etc. — Req 2.4), and a citation list of source URLs + timestamps (Req 2.2). Summaries are cached per article-cluster so the same LLM call isn't repeated per user.
- **Notification trigger**: New summaries for a player on a user's roster/watchlist enqueue a push notification job with the one-line summary (Req 2.3).
- **Empty state**: If no summary exists for a player, the API returns an explicit `{ status: "no_recent_news" }` rather than an empty array, so the client can render a clear empty state (Req 2.5).

### 5. Subscription Service

- Client uses RevenueCat SDK for purchase flow; RevenueCat talks to App Store/Google Play so the app never touches raw payment data (Req 4.6).
- Backend subscribes to RevenueCat webhooks (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`) to update the user's entitlement record — this is the authoritative source the API checks on every premium-gated request, not the client's local receipt (Req 4.2, 4.5).
- A scheduled job checks upcoming expirations and enqueues the 7-day/1-day reminder notifications (Req 4.3).
- "Restore purchases" (Req 4.4) calls RevenueCat's restore flow client-side, which resolves to the same backend entitlement record keyed by user, not by device.

### 6. Auth & Account Linking

- Primary email/password auth is implemented with bcrypt password hashes and short-lived JWT access tokens. Sign in with Apple and Google remain planned (Req 5.1).
- Refresh tokens are opaque random values; only HMAC-SHA256 hashes are stored in `RefreshSession`. Every refresh consumes and rotates the token atomically. Reuse of an already-consumed token revokes all active sessions in that token family.
- Protected REST routes verify the access JWT. Socket.IO verifies it during the handshake, and native draft access additionally requires a `DraftParticipant` membership row.
- Mobile session handling is implemented with an `AuthSessionManager` wrapped by `AuthProvider`. The access JWT is memory-only; one SecureStore JSON record atomically stores the rotating refresh token, refresh expiry, and user metadata. Startup restoration and all concurrent refresh callers are single-flighted so React Strict Mode or simultaneous REST/socket work cannot consume a one-time refresh token twice. Refresh is scheduled before access expiry, protected REST calls retry exactly once after a 401, and Socket.IO updates handshake auth after rotation with one forced unauthorized retry.
- External league linking stores only OAuth tokens (Yahoo) — never platform passwords (Req 5.2). ESPN is out of v1 scope.
- Disconnecting a league (Req 5.4) deletes cached roster/league rows for that link and revokes stored tokens.

### 7. Push Notification Service

- **Mobile registration**: Once authentication succeeds, the Expo client creates a stable, non-secret installation ID in SecureStore, configures Android's high-priority `draft-turns` channel, requests notification permission, obtains an Expo push token using EAS project metadata (or `EXPO_PUBLIC_EAS_PROJECT_ID`), and registers it through an authenticated endpoint. Registration is single-flighted and retried whenever the app becomes active. Logout best-effort deactivates only that installation while the access token is still valid.
- **Turn producers**: Initial draft start and the common row-locked transition used by manual, auto, and skip picks create a `TurnNotificationOutbox` row in the same Postgres transaction as the resulting turn. Uniqueness on `(draftId, pickIndex, userId)` prevents duplicate logical alerts, while no external network call occurs in the latency-sensitive draft path.
- **Delivery**: A Fastify-lifecycle worker atomically claims pending rows, sends high-priority messages through Expo Push Service, persists ticket IDs, retries transient failures with bounded exponential backoff, recovers stale claims, and skips alerts after that turn's clock expires. `DeviceNotRegistered` tickets disable stale tokens. `EXPO_ACCESS_TOKEN` supports Expo enhanced push security when enabled.
- **Interaction**: Foreground notifications are presented. Cold-start and live notification responses validate `type: draft.on_the_clock` and navigate through the protected Expo Router draft route.

## Data Models (core entities)

```
User { id, email, passwordHash, authProviders[], createdAt }
RefreshSession { id, userId, tokenHash(HMAC-SHA256), familyId, expiresAt, revokedAt, createdAt }
Entitlement { userId, tier, seasonId, expiresAt, source(revenuecat), status }
LeagueLink { id, userId, platform(native|yahoo|sleeper|espn), externalLeagueId, credentials(encrypted), lastSyncedAt, status }
League { id, name, platform, scoringSettings, rosterSettings, seasonId }
Draft { id, leagueId, order[], currentPickIndex, clockSeconds, status, settings }
DraftParticipant { draftId, userId, teamId } // unique user and team per draft
Pick { id, draftId, pickIndex, teamId, playerId|null, madeAt, source }
PushToken { id, userId, token, installationId, platform, enabled, lastSeenAt }
TurnNotificationOutbox { id, draftId, pickIndex, userId, status, attempts, nextAttemptAt, expoTicketIds[], expiresAt }
Player { id, name, position, team, byeWeek, externalIds{yahoo, sleeper, espn} }
ProjectionRanking { playerId, seasonId, scoringType, rank, projectedPoints, updatedAt }
NewsArticle { id, playerId, sourceUrl, publishedAt, rawText }
NewsSummary { id, articleClusterId, playerId, summaryText, impactTag, citedSources[], generatedAt }
Watchlist { userId, playerId }
```

## Real-Time Sync Design (cross-cutting detail for Requirement 3)

Since "all real-time sync" was called out specifically, here's the concrete guarantee per source:

| Draft source | Mechanism | Practical latency | Notes |
|---|---|---|---|
| Native app draft | WebSocket push, server-authoritative | < 1s (Req 3.1) | Full guarantee, this is the flagship experience |
| Yahoo-linked draft | OAuth polling, re-emitted over the same WebSocket room | ~2-5s | Bounded by Yahoo API rate limits; no vendor push available |
| Sleeper-linked draft | Unauthenticated polling, re-emitted over WebSocket | ~2-3s | Sleeper has no webhook/push mechanism either |
| ESPN-linked draft (opt-in, pending your approval) | Cookie-based polling | ~3-5s, fragile | Unofficial method, disclose to users |

All three external paths funnel into the same client-side event contract (`pick.made`, `turn.changed`, etc.) so the mobile UI has one code path regardless of source — only the badge/indicator differs ("Live" vs "Synced from Sleeper Xs ago").

## Error Handling

- **AI provider outage**: Recommendation Service falls back to the deterministic ranking engine and returns `degraded: true` so the client can show a small "AI insights unavailable" banner (Req 1.6).
- **External platform outage/rate-limit**: League Sync Service backs off exponentially per platform, surfaces `syncStatus: stale` to the client with a "last updated" timestamp rather than failing silently.
- **Draft pick race**: handled via DB-level locking as described above; rejected client gets a specific error code (`PICK_ALREADY_TAKEN`) and a fresh state snapshot.
- **Push delivery failure**: Draft transitions commit independently of Expo availability. The outbox retries network/429/5xx failures with backoff, suppresses stale turns after their deadline, and disables tokens reported as unregistered.
- **Payment/webhook failures**: RevenueCat webhook handler is idempotent (dedup by event ID) and retries via the job queue on transient failure; entitlement checks default to "not entitled" if state is ever ambiguous (fail closed, not open).

## Security Considerations

- All LLM calls happen server-side; no API keys ship in the mobile client.
- External platform credentials (OAuth tokens, ESPN cookies) encrypted at rest (e.g. KMS-backed envelope encryption), never logged.
- JWT access tokens are short-lived and verified on protected REST requests and Socket.IO handshakes. Refresh tokens are opaque, rotated atomically, stored only as keyed hashes, and grouped into revocable families for reuse detection.
- Native draft access is bound to `DraftParticipant(userId, draftId, teamId)`. The server derives team identity from this row on every pick and never trusts a client-supplied team ID.
- Rate limiting on all public-facing endpoints, especially anything proxying to the LLM (cost control) and anything touching external platform APIs (avoid getting the app's IP/keys banned).
- This design does not yet include a threat model for the ESPN cookie-based path in detail — flagged as a risk area to revisit if we proceed with that integration.

## Testing Strategy

- **Mobile auth/session**: pure session-manager tests cover startup refresh rotation, duplicate bootstrap suppression, concurrent refresh single-flight, rejected-token credential cleanup, bearer injection, and the exactly-one retry rule.
- **Push notifications**: integration tests cover authenticated token registration/deactivation, transactional turn enqueue/deduplication, initial and subsequent turn targeting, Expo payloads/ticket persistence, invalid-device shutdown, and trusted mobile navigation payload parsing.
- **Draft Room Service**: concurrency tests simulating simultaneous `pick.submit` calls for the same player to verify deterministic conflict resolution; reconnect tests verifying state reconciliation.
- **League Sync Service**: contract tests against recorded fixtures of Yahoo/Sleeper API responses (avoids hammering real APIs in CI); polling backoff tests.
- **Recommendation Service**: snapshot tests ensuring the LLM layer never recommends a player outside the deterministic candidate set (guards against hallucination).
- **Subscription Service**: webhook idempotency tests (duplicate event delivery), entitlement expiry tests.
- **End-to-end**: a scripted "full mock draft" test that runs a native draft from start to finish across multiple simulated clients.

## Decisions

1. **Stack**: confirmed as React Native + Node/TypeScript + Postgres/Redis + RevenueCat, per above.
2. **News data source**: no specific provider selected yet. The News Ingestion Service is built against an internal `NewsProvider` interface (fetch-by-player, fetch-recent) so a concrete vendor (e.g. RotoWire, SportRadar) can be plugged in without changing the summarizer or notification pipeline. A provider must still be selected before Requirement 2 can ship — treat this as a procurement task, not an engineering blocker.
3. **ESPN integration**: out of scope for v1. ESPN has no official API; the only community method relies on scraping session cookies from an authenticated browser, which is unofficial and can break without warning. v1 ships Yahoo + Sleeper only. `LeagueLink.platform` still includes `espn` as a value so it can be added later without a schema migration, but no sync logic is built for it now.
4. **Sport scope for v1**: NFL only. `League.scoringSettings`/`rosterSettings` are modeled generically enough to extend to other sports later, but all v1 ranking/projection/news logic assumes NFL.
5. **Draft board ownership for external leagues**: Yahoo and Sleeper leagues are read-only/assist mode — the app mirrors live draft state and layers AI recommendations on top, but the pick itself is still made on the native Yahoo/Sleeper app or site. This is a hard constraint for Sleeper regardless (its API is read-only), and avoids taking on Yahoo's write-API complexity and risk of picks failing to land on the platform that actually runs the league. Only native in-app drafts support submitting a pick through Fantasy Draft Assistant itself.
