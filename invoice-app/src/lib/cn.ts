/**
 * Tiny classnames merger — like clsx, but no deps.
 * Filters falsy values and joins with a space.
 */
export type ClassValue = string | number | null | false | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v && v !== 0) return;
    if (Array.isArray(v)) v.forEach(walk);
    else out.push(String(v));
  };
  inputs.forEach(walk);
  return out.join(' ');
}
