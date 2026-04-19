export const pickCircular = <T>(arr: T[], idx: number): T => arr[idx % arr.length]
