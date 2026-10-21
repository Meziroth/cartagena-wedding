import { describe, expect, it } from 'vitest';
import { parseInvite } from '../functions/invite/validate.ts';

describe('invite request', () => {
  it('normalizes a valid invite', () => {
    expect(parseInvite({ email: ' Thuraya@Example.COM ', displayName: ' Thuraya ', role: 'owner', redirectTo: 'https://x.github.io/cartagena-wedding/' }))
      .toEqual({ invite: { email: 'thuraya@example.com', displayName: 'Thuraya', role: 'owner', redirectTo: 'https://x.github.io/cartagena-wedding/' } });
  });

  it('rejects bad emails, names and roles', () => {
    expect(parseInvite(null)).toHaveProperty('error');
    expect(parseInvite({ email: 'nope', displayName: 'A', role: 'planner' })).toEqual({ error: 'Enter a valid email address.' });
    expect(parseInvite({ email: 'a@b.co', displayName: '  ', role: 'planner' })).toEqual({ error: 'Enter their name.' });
    expect(parseInvite({ email: 'a@b.co', displayName: 'x'.repeat(61), role: 'planner' })).toHaveProperty('error');
    expect(parseInvite({ email: 'a@b.co', displayName: 'A', role: 'admin' })).toEqual({ error: 'Choose Owner or Planner.' });
  });

  it('drops redirect addresses that aren’t web URLs', () => {
    const r = parseInvite({ email: 'a@b.co', displayName: 'A', role: 'planner', redirectTo: 'javascript:alert(1)' });
    expect(r).toEqual({ invite: { email: 'a@b.co', displayName: 'A', role: 'planner', redirectTo: undefined } });
  });
});
