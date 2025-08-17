import { describe, test, expect } from '@jest/globals'

describe('basic test', () => {
  test('should pass basic assertion', () => {
    expect(1).toBe(1)
  })

  test('should do basic math', () => {
    expect(2 + 2).toBe(4)
  })

  test('should compare strings', () => {
    expect('hello').toBe('hello')
  })
})
