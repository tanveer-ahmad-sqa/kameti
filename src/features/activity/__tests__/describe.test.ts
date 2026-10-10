import i18n from '@/i18n';

import { describeActivity, type ActivityContext, type ActivityEntry } from '../describe';

const t = i18n.t.bind(i18n);

const ctx: ActivityContext = {
  memberName: (id) => ({ m1: 'Ayesha', m2: 'Bilal' })[id ?? ''] ?? 'a member',
  actorName: (userId) => (userId === null ? 'Kameti' : ({ u1: 'Ayesha', u2: 'Bilal' }[userId] ?? 'Someone')),
  cycleNumber: (id) => ({ c1: 1, c2: 2 })[id ?? ''],
};

function entry(action: string, payload: unknown, extra: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 1,
    actor_id: 'u1',
    action,
    entity_type: action.split('.')[0] ?? 'committee',
    entity_id: null,
    payload,
    created_at: '2027-01-05T10:00:00Z',
    ...extra,
  };
}

describe('describeActivity', () => {
  it.each([
    [entry('committee.created', {}), 'Ayesha created the committee'],
    [entry('committee.activated', {}), 'Ayesha started the committee'],
    [entry('committee.completed', {}, { actor_id: null }), 'The committee is complete'],
    [entry('member.added', { display_name: 'Sana' }, { entity_id: 'm3' }), 'Ayesha added Sana'],
    [
      entry('member.joined', { display_name: 'Bilal' }, { actor_id: 'u2', entity_id: 'm2' }),
      'Bilal joined the app',
    ],
    [entry('order.drawn', { draw_number: '2' }, { entity_type: 'draw' }), 'Ayesha ran random draw 2'],
    [
      entry('order.changed', { reason: 'Wedding in March' }, { entity_type: 'committee' }),
      'Ayesha changed the payout order: Wedding in March',
    ],
    [
      entry('payout.completed', { cycle_number: 1, recipient_member_id: 'm2' }, { entity_type: 'cycle' }),
      'Ayesha paid out month 1 to Bilal',
    ],
    [
      entry('payment.claimed', { member_id: 'm2', cycle_id: 'c2' }, { actor_id: 'u2' }),
      'Bilal marked their payment for month 2 as paid',
    ],
    [
      entry('payment.confirmed', { member_id: 'm2', cycle_id: 'c2' }),
      "Ayesha confirmed Bilal's payment for month 2",
    ],
    [
      entry('payment.marked_late', { member_id: 'm2', cycle_id: 'c1' }, { actor_id: null }),
      "Bilal's payment for month 1 is late",
    ],
  ])('%#: %j', (input, expected) => {
    expect(describeActivity(t, input, ctx)).toBe(expected);
  });

  it('falls back gracefully for unknown actions', () => {
    expect(describeActivity(t, entry('something.new', {}), ctx)).toBe('Ayesha made a change');
  });
});
