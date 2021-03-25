const sum = (termA: number, termB: number): number => termA + termB;

describe('sum', () => {
  it('should calculate correct sum', () => {
    expect(sum(1, 2)).toBe(3);
  });
});
