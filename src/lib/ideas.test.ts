import { describe, expect, it } from 'vitest';
import { buildMockData, MOCK_USERS } from '../mock/mockData';
import { boardIdeas, bothLove, fitWithin, hostOf, normalizeUrl, ownerIds } from './ideas';

describe('inspiration board', () => {
  const d = buildMockData();
  const owners = ownerIds(d.members);

  it('counts "both love it" as every owner hearting it', () => {
    expect(owners).toEqual([MOCK_USERS.nick, MOCK_USERS.thuraya]);
    expect(bothLove('i-lights', d.idea_votes, owners)).toBe(true);
    expect(bothLove('i-bougain', d.idea_votes, owners)).toBe(false);
    expect(bothLove('i-lights', d.idea_votes, [])).toBe(false);
  });

  it('filters by tag or by both-love, newest first', () => {
    expect(boardIdeas(d.ideas, d.idea_votes, owners, 'Both love', 'new').map((i) => i.id)).toEqual(['i-lights', 'i-table', 'i-palette']);
    expect(boardIdeas(d.ideas, d.idea_votes, owners, 'Décor', 'new').map((i) => i.id)).toEqual(['i-table', 'i-doors']);
    expect(boardIdeas(d.ideas, d.idea_votes, owners, 'All', 'new')).toHaveLength(6);
  });

  it('sorts by most hearts, then newest', () => {
    const ids = boardIdeas(d.ideas, d.idea_votes, owners, 'All', 'loved').map((i) => i.id);
    expect(ids.slice(0, 3)).toEqual(['i-lights', 'i-table', 'i-palette']);
  });
});

describe('links and images', () => {
  it('reads hosts and fixes pasted addresses', () => {
    expect(hostOf('https://www.pinterest.com/pin/123/')).toBe('pinterest.com');
    expect(hostOf('nope')).toBe('');
    expect(normalizeUrl('pin.it/abc')).toBe('https://pin.it/abc');
    expect(normalizeUrl(' https://www.instagram.com/p/x ')).toBe('https://www.instagram.com/p/x');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('hello')).toBeNull();
  });

  it('shrinks photos to fit 1600px without enlarging small ones', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
