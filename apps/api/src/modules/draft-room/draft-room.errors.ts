/**
 * Typed errors for the Draft Room state machine. Each maps directly to a
 * `pick.rejected` reason code in the shared WebSocket event contract
 * (@fantasy-draft/shared DraftEvent), so the gateway layer can translate
 * 1:1 without re-deriving the reason from a generic Error message.
 */
export class DraftError extends Error {
  constructor(
    message: string,
    public readonly code: 'PICK_ALREADY_TAKEN' | 'NOT_YOUR_TURN' | 'INVALID_PLAYER' | 'DRAFT_NOT_FOUND' | 'DRAFT_NOT_IN_PROGRESS',
  ) {
    super(message);
    this.name = 'DraftError';
  }
}
