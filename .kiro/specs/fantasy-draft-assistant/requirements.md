# Requirements Document

## Introduction

Fantasy Draft Assistant is a mobile app that helps fantasy sports players make better draft decisions. It combines AI-generated draft recommendations, summarized player news, a real-time synced live draft mode, and a seasonal subscription model for monetization.

## Requirements

### Requirement 1: AI Draft Recommendations

**User Story:** As a fantasy sports player, I want AI-generated pick recommendations during my draft, so that I can make faster, better-informed decisions without manually researching every player.

#### Acceptance Criteria

1. WHEN a user is on the clock during a draft THEN the system SHALL display a ranked list of recommended players for the current pick.
2. WHEN generating recommendations THEN the system SHALL factor in roster construction (positions already filled/needed), league scoring settings, draft position, and player availability.
3. WHEN a user requests it THEN the system SHALL explain the reasoning behind a specific recommendation (e.g. "best available RB with high upside, fills your flex need").
4. IF league scoring format is PPR, Standard, or custom THEN the system SHALL adjust rankings and recommendations accordingly.
5. WHEN new information affecting rankings becomes available (injury, depth chart change) THEN the system SHALL update recommendations within 5 minutes.
6. WHEN the AI recommendation service is unavailable THEN the system SHALL fall back to static consensus rankings and SHALL notify the user that live AI recommendations are temporarily unavailable.

### Requirement 2: Player News Summaries

**User Story:** As a fantasy sports player, I want concise AI-summarized news about players, so that I can quickly understand what matters without reading full articles.

#### Acceptance Criteria

1. WHEN a user views a player's profile THEN the system SHALL display a summary of the most recent relevant news for that player.
2. WHEN a news summary is generated THEN the system SHALL cite the original source(s) and publish timestamp.
3. WHEN new news breaks for a player on a user's roster or watchlist THEN the system SHALL send a push notification with a one-line summary.
4. WHEN summarizing news THEN the system SHALL flag fantasy-relevant impact (e.g. "Out", "Questionable", "Role change") as a distinct tag separate from the prose summary.
5. IF no recent news exists for a player THEN the system SHALL display a "no recent news" state rather than an empty screen.

### Requirement 3: Live Draft Mode (Real-Time Sync)

**User Story:** As a fantasy sports player, I want my draft picks and draft board to stay in real-time sync with my league mates, so that everyone sees the same draft state instantly regardless of platform (native draft room or a connected external league).

#### Acceptance Criteria

1. WHEN a draft is in progress THEN all connected clients SHALL see pick updates within 1 second of the pick being made.
2. WHEN a user connects to a live draft THEN the system SHALL sync full current draft state (picks made, current turn, clock remaining, roster state) before allowing interaction.
3. WHEN a user's connection drops and reconnects THEN the system SHALL restore them to the correct draft state without requiring a manual refresh.
4. WHEN it is a user's turn to pick THEN the system SHALL start a countdown clock consistent with league settings and SHALL notify the user via push notification.
5. IF a user's pick timer expires THEN the system SHALL either auto-pick (best available per queue/rankings) or skip per league settings.
6. WHEN a league is hosted on a supported external platform (e.g. Yahoo, ESPN, Sleeper) THEN the system SHALL sync draft state from that platform in near real time using the platform's API or polling where no push mechanism exists.
7. WHEN a draft is native to the app (not tied to an external platform) THEN the system SHALL host the full live draft room including turn order, timer, and pick submission.
8. WHEN multiple users act concurrently (e.g. two users try to draft the same player) THEN the system SHALL resolve conflicts deterministically with a single authoritative server state, and SHALL notify the losing client immediately.

### Requirement 4: Seasonal Subscriptions

**User Story:** As a fantasy sports player, I want to subscribe for a season to unlock premium features, so that the app's cost aligns with the length of my fantasy season.

#### Acceptance Criteria

1. WHEN a user is not subscribed THEN the system SHALL restrict access to premium features (AI recommendations, live draft mode, news summaries) per a defined free-tier boundary.
2. WHEN a user purchases a seasonal subscription THEN the system SHALL grant premium access for the duration of the purchased season and SHALL reflect entitlement across all the user's devices.
3. WHEN a subscription is near expiration (7 days, 1 day) THEN the system SHALL notify the user before losing access.
4. WHEN a user requests to restore purchases THEN the system SHALL restore prior valid entitlements on a new device or after reinstall.
5. WHEN a subscription payment fails or is refunded THEN the system SHALL revoke premium access accordingly.
6. WHEN handling payment and subscription data THEN the system SHALL NOT store raw payment credentials and SHALL rely on the platform billing provider (App Store/Google Play or RevenueCat) for PCI-sensitive data handling.

### Requirement 5: Cross-Cutting - Accounts & League Connections

**User Story:** As a fantasy sports player, I want to link my existing fantasy league accounts, so that the assistant works with the leagues I already play in.

#### Acceptance Criteria

1. WHEN a user signs up THEN the system SHALL support account creation via email or OAuth (Apple/Google Sign-In).
2. WHEN a user links an external fantasy platform account THEN the system SHALL use OAuth where the platform supports it and SHALL never request or store the user's platform password directly.
3. IF a linked platform's API/session token expires THEN the system SHALL prompt the user to re-authenticate before further syncing.
4. WHEN a user disconnects a linked league THEN the system SHALL stop syncing and SHALL delete cached league-specific data within a reasonable retention window.
