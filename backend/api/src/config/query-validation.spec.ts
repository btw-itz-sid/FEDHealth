import { enumFilter, pagination } from './query-validation';

describe('List query validation', () => {
  it('accepts defaults and normal query-string numbers', () => {
    expect(pagination({})).toEqual({ page: 1, limit: 20 });
    expect(pagination({ page: '2', limit: '5' } as any)).toEqual({ page: 2, limit: 5 });
  });
  it.each([{ page: -1 }, { page: 0 }, { page: NaN }, { page: 1.5 }, { limit: -1 }, { limit: 0 }, { limit: 101 }, { limit: Infinity }])('rejects invalid pagination %j before reaching PostgreSQL', value => {
    expect(() => pagination(value)).toThrow('integer');
  });
  it('rejects unrecognized enum filters before a database cast can fail', () => {
    expect(() => enumFilter('invalid', { READY: 'ready' }, 'status')).toThrow('Invalid status');
    expect(() => enumFilter(undefined, { READY: 'ready' }, 'status')).not.toThrow();
  });
});
