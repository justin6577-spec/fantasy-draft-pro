# Implementation Plan

- [x] 1. Project scaffolding
  - [x] 1.1 Initialize monorepo structure (`/apps/mobile` for React Native/Expo, `/apps/api` for Node/TypeScript backend, `/packages/shared` for shared types)
  - [x] 1.2 Set up API project (Fastify or NestJS), TypeScript config, linting/formatting, environment config loading
  - [x] 1.3 Set up Postgres schema/migration tooling (e.g. Prisma or Drizzle) and Redis connection
  - [x] 1.4 Set up mobile project (Expo + TypeScript), navigation shell, and base design system (theme, typography, shared components)
  - [x] 1.5 Set up CI (lint + typecheck + test on PR) for both apps
  - [x] 1.6 Local dev infra: docker-compose.yml for Postgres 16 + Redis 7, initial Prisma migration applied
  - _Requirements: (foundation for all)_

- [~] 2. Auth & accounts
  - [x] 2.1 Implement User model, email/password signup+login with bcrypt password hashes, short-lived JWT access tokens, opaque rotating refresh tokens stored as HMAC hashes, refresh-family reuse revocation, logout, and `/auth/me`
  - [ ] 2.2 Add Sign in with Apple and Google Sign-In flows (mobile + backend token verification)
  - [x] 2.3 Build mobile email signup/login screens, `Stack.Protected` route guards, SecureStore-backed refresh-token persistence, memory-only access tokens, automatic scheduled/single-flight rotation, startup restoration, logout, and authenticated REST/Socket.IO clients
  - [x] 2.4 Add backend integration tests for signup/login, access verification, refresh rotation/reuse detection, and logout revocation (`auth.routes.test.ts`)
  - _Requirements: 5.1_

- [~] 3. Core domain data model
  - [x] 3.1 Implement Player, League, Draft, Pick, LeagueLink schemas/migrations (`prisma/schema.prisma`, migrated)
  - [ ] 3.2 Seed/import NFL player reference data (id, name, position, team, bye week, external platform IDs)
  - [ ] 3.3 Implement ProjectionRanking model and an initial static ranking import (placeholder consensus rankings) — model exists in schema, no seed data yet
  - _Requirements: 1.4, 1.6_

- [~] 4. Native live draft room (Requirement 3, native path)
  - [x] 4.1 Implement Draft/Pick server-side state machine with Postgres transactional locking for pick submission (`draft-room.service.ts`, `SELECT ... FOR UPDATE` row lock)
  - [x] 4.2 Implement authenticated WebSocket gateway (Socket.IO) with room-per-draft and event contract (`pick.made`, `turn.changed`, `clock.tick`, `draft.completed`, `pick.rejected`); access JWT is verified during the handshake, joins require `DraftParticipant`, and `teamId` is derived server-side rather than accepted from the client
  - [x] 4.3 Implement server-side draft clock backed by Redis (survives restarts), auto-pick/skip on expiry (`draft-clock.ts`, deadline-based not setTimeout-based)
  - [x] 4.4 Implement reconnect/state-reconciliation flow (client sends last known pick index, server replays delta or full snapshot) (`getReconciliation`)
  - [x] 4.5 Build mobile Draft Room screen with authenticated REST snapshot, Socket.IO reconciliation, server-issued team identity, turn/clock state, guarded pick submission, rejection recovery, connection status, live board, and transactional "on the clock" Expo push notifications
  - [x] 4.6 Write concurrency test simulating simultaneous pick submissions for the same player (`draft-room.service.test.ts`, runs against real Postgres via docker-compose)
  - [x] 4.7 Write reconnect test verifying correct state restoration
  - [x] 4.8 Write authenticated REST/WebSocket authorization test covering unauthenticated rejection, outsider denial, participant identity, and forged-client-team prevention (`draft-room.authorization.test.ts`)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_
  - _Note: auto-pick path falls through to skip until the ranking engine (task 8.1) and a seeded Player pool exist - `computeCandidates()` is still a stub returning `[]`._

- [ ] 5. External league sync — Sleeper (Requirement 3, external path)
  - [ ] 5.1 Implement Sleeper client (league/draft/roster read endpoints, no auth required)
  - [ ] 5.2 Implement polling worker that diffs Sleeper draft state and re-emits app-native events into the same WebSocket room model
  - [ ] 5.3 Add "synced Xs ago" / staleness indicator support to the event contract and mobile UI
  - [ ] 5.4 Write contract tests against recorded Sleeper API response fixtures
  - _Requirements: 3.2, 3.6_

- [ ] 6. External league sync — Yahoo (Requirement 3 + 5, external path)
  - [ ] 6.1 Register Yahoo Developer app, implement 3-legged OAuth flow (mobile handoff + backend token exchange/storage, encrypted at rest)
  - [ ] 6.2 Implement Yahoo Fantasy API client for league/draft/roster reads
  - [ ] 6.3 Implement polling worker mirroring Yahoo draft state into the same event model as Sleeper/native
  - [ ] 6.4 Implement re-auth prompt flow when a Yahoo token expires
  - [ ] 6.5 Write contract tests against recorded Yahoo API response fixtures
  - _Requirements: 3.2, 3.6, 5.2, 5.3_

- [ ] 7. League link management
  - [ ] 7.1 Build "link a league" UI flow (choose platform, OAuth or league ID entry)
  - [ ] 7.2 Implement disconnect flow: revoke tokens, delete cached league-specific data
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 8. AI draft recommendations
  - [x] 8.1 Implement deterministic ranking engine (value-based drafting math, positional scarcity, roster-need weighting) as the non-LLM fallback and candidate generator
  - [x] 8.2 Implement Recommendation Service: given draft state, produce ranked candidate list from the deterministic engine
  - [x] 8.3 Layer LLM call on top for natural-language reasoning, constrained strictly to the candidate list from 8.2 (no free-form player suggestions)
  - [x] 8.4 Implement caching of recommendations keyed by draft-state hash
  - [x] 8.5 Implement fallback path + `degraded: true` flag when the LLM provider is unavailable
  - [x] 8.6 Build mobile "Recommended Picks" panel in the draft room with "why" expandable explanation
  - [x] 8.7 Write tests ensuring LLM output never references a player outside the candidate set
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 9. Player news summaries
  - [ ] 9.1 Define internal `NewsProvider` interface and a placeholder/mock implementation for local dev
  - [ ] 9.2 Implement news ingestion worker (polling cadence, dedup by source+timestamp), store raw articles by player
  - [ ] 9.3 Implement LLM summarization producing summary text, impact tag, and cited sources; cache per article cluster
  - [ ] 9.4 Implement "no recent news" explicit empty state in the API response
  - [ ] 9.5 Implement push notification trigger for new summaries on rostered/watchlisted players
  - [ ] 9.6 Build mobile Player Profile screen with news summary section and impact tag UI
  - [ ] 9.7 Build Watchlist add/remove UI and backend endpoints
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 10. Seasonal subscriptions
  - [ ] 10.1 Integrate RevenueCat SDK in mobile app (purchase flow, restore purchases)
  - [ ] 10.2 Implement backend Entitlement model and RevenueCat webhook handler (idempotent, covers purchase/renewal/cancellation/expiration/billing issue)
  - [ ] 10.3 Implement premium-gating middleware on recommendation/news/live-draft endpoints based on backend entitlement state (fail closed)
  - [ ] 10.4 Implement expiration reminder job (7-day, 1-day notifications)
  - [ ] 10.5 Build mobile paywall screens and free-tier boundary UI treatment
  - [ ] 10.6 Write webhook idempotency and entitlement-expiry tests
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [~] 11. Notifications infrastructure
  - [x] 11.1 Set up Expo permission/token registration, authenticated per-installation token persistence/deactivation, Android draft channel, foreground display, notification-tap routing, Expo Push API delivery, invalid-token shutdown, and a retrying transactional outbox worker
  - [~] 11.2 "On the clock" notifications are complete for initial/manual/auto/skip native-draft turns; player-news (Req 2.3) and subscription-expiration (Req 4.3) producers remain to be wired through the same delivery infrastructure
  - _Requirements: 2.3, 3.4, 4.3_

- [ ] 12. End-to-end verification
  - [ ] 12.1 Scripted multi-client mock draft test (native path) from start to finish
  - [ ] 12.2 Manual verification pass against every acceptance criterion in requirements.md
  - _Requirements: all_
