import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// Node 25 ships an experimental global `localStorage` (Web Storage) that has no
// backing file in tests, so it lacks a working `clear()` and shadows jsdom's
// implementation. Install a clean in-memory Storage so the app's localStorage
// persistence is testable. Reset before each test for isolation.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }
}

const memoryStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: memoryStorage,
})

// jsdom doesn't implement scrollIntoView; stub it so components that scroll the
// edit form into view don't throw under test.
Element.prototype.scrollIntoView = () => {}

beforeEach(() => memoryStorage.clear())
