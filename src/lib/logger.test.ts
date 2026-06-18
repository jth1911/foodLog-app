import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { log, readLog, clearLog, LOG_KEY, LOG_CAP, type LogEntry } from './logger'

describe('logger', () => {
  beforeEach(() => {
    // The shared MemoryStorage is cleared per test by vitest.setup, but be
    // explicit so these tests don't depend on that ordering.
    clearLog()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-17T08:30:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns an empty array when nothing has been logged', () => {
    expect(readLog()).toEqual([])
  })

  it('appends an entry with a timestamp, level and message', () => {
    log('info', 'Hello')
    const entries = readLog()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual<LogEntry>({
      ts: '2026-06-17T08:30:00.000Z',
      level: 'info',
      message: 'Hello',
    })
  })

  it('stores optional structured context when provided', () => {
    log('error', 'Auto-fill failed', { food: 'Egg', error: 'quota exceeded' })
    expect(readLog()[0].context).toEqual({ food: 'Egg', error: 'quota exceeded' })
  })

  it('keeps entries in chronological (append) order', () => {
    log('info', 'first')
    vi.setSystemTime(new Date('2026-06-17T08:31:00.000Z'))
    log('warn', 'second')
    expect(readLog().map((e) => e.message)).toEqual(['first', 'second'])
  })

  it('caps the log at the last LOG_CAP entries, dropping the oldest', () => {
    for (let i = 0; i < LOG_CAP + 25; i++) log('info', `entry ${i}`)
    const entries = readLog()
    expect(entries).toHaveLength(LOG_CAP)
    // Oldest 25 dropped; newest kept.
    expect(entries[0].message).toBe('entry 25')
    expect(entries[LOG_CAP - 1].message).toBe(`entry ${LOG_CAP + 24}`)
  })

  it('treats a corrupt stored value as empty', () => {
    localStorage.setItem(LOG_KEY, 'not json')
    expect(readLog()).toEqual([])
  })

  it('treats a wrong-shaped stored value as empty', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify({ not: 'an array' }))
    expect(readLog()).toEqual([])
  })

  it('clearLog empties the log', () => {
    log('info', 'something')
    clearLog()
    expect(readLog()).toEqual([])
  })

  it('never throws when a write fails', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => log('info', 'boom')).not.toThrow()
    spy.mockRestore()
  })
})
