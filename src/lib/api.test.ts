import { describe, expect, it } from 'vitest'
import { mergeAuthHeaders } from './api'

describe('mergeAuthHeaders', () => {
  it('agrega Bearer y conserva content-type del body', () => {
    const headers = mergeAuthHeaders({ body: '{}' }, 'tok-1')

    expect(headers.get('authorization')).toBe('Bearer tok-1')
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('no inventa content-type si no hay body', () => {
    const headers = mergeAuthHeaders(undefined, 'tok-2')

    expect(headers.get('authorization')).toBe('Bearer tok-2')
    expect(headers.has('content-type')).toBe(false)
  })

  it('omite Authorization si no hay token', () => {
    const headers = mergeAuthHeaders({ body: '{}' }, null)

    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('content-type')).toBe('application/json')
  })
})
