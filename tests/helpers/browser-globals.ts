// Just enough of a browser for modules that touch window and navigator at
// call time. Imported first (imports are hoisted in order) by tests of
// browser-side modules such as the outbox.
export const fakeStorage = new Map<string, string>();
const g = globalThis as unknown as { window: unknown };
g.window = {
  localStorage: {
    getItem: (k: string) => fakeStorage.get(k) ?? null,
    setItem: (k: string, v: string) => void fakeStorage.set(k, v),
    removeItem: (k: string) => void fakeStorage.delete(k),
  },
  addEventListener: () => {},
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (t: NodeJS.Timeout) => clearTimeout(t),
  location: { pathname: "/test" },
};
// Node has a read-only navigator getter; define over it.
Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "test" }, configurable: true, writable: true });
