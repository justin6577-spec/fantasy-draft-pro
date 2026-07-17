import { describe, expect, it } from 'vitest';
import { draftIdFromNotificationData } from './notification-data';

describe('draftIdFromNotificationData', () => {
  it('accepts only an on-the-clock payload with a string draft ID', () => {
    expect(
      draftIdFromNotificationData({
        type: 'draft.on_the_clock',
        draftId: 'draft-123',
        route: '/draft/draft-123',
      }),
    ).toBe('draft-123');

    expect(draftIdFromNotificationData({ type: 'news', draftId: 'draft-123' })).toBeNull();
    expect(
      draftIdFromNotificationData({ type: 'draft.on_the_clock', draftId: { unsafe: true } }),
    ).toBeNull();
    expect(draftIdFromNotificationData(null)).toBeNull();
  });
});
