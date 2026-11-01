export type Change = { field: string; oldValue: string | null; newValue: string | null };

function render(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || (typeof value === "object" && "toFixed" in value)) {
    return String(Math.round(Number(value) * 100) / 100);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const same = (a: string | null, b: string | null, numeric: boolean) =>
  numeric && a !== null && b !== null ? Number(a) === Number(b) : (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** Lista os campos que mudaram. Diferenças só de maiúsculas não contam como alteração. */
export function diffFields<T extends object>(current: Partial<Record<keyof T, unknown>>, next: Partial<T>, fields: (keyof T & string)[]): Change[] {
  const changes: Change[] = [];
  for (const field of fields) {
    const oldValue = render(current[field]);
    const newValue = render(next[field]);
    const numeric = typeof next[field] === "number";
    if (!same(oldValue, newValue, numeric)) changes.push({ field, oldValue, newValue });
  }
  return changes;
}
