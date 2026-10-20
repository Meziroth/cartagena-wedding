export const sum = <T,>(items: readonly T[], f: (x: T) => number): number =>
  items.reduce((t, x) => t + (Number(f(x)) || 0), 0);
