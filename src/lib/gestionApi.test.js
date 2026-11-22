import { describe, it, expect } from 'vitest'
import { productPayload, canManageProducts, canManageAccounts } from './gestionApi'
import { loginIdentity, INTERNAL_ADMIN_EMAIL } from './loginIdentity'
const draft = { name: 'Equipos', type: 'LAPTOP', quantity: 2, codes: 'EQ-001\nEQ-002', from: '2030-01-01', until: '2030-12-31', roles: ['DOCENTE'], enabled: true }
describe('validación de productos', () => {
  it('rechaza cantidades fraccionarias, códigos repetidos y roles vacíos', () => {
    for (const value of [{ ...draft, quantity: 1.5 }, { ...draft, codes: 'EQ-001\neq-001' }, { ...draft, roles: [] }, { ...draft, until: '2029-12-31' }]) expect(() => productPayload(value)).toThrow()
  })
  it('calcula la solicitud de unidades sin enviar cantidades inconsistentes al servidor', () => {
    expect(productPayload(draft).p_codigos).toEqual(['EQ-001', 'EQ-002'])
    expect(productPayload(draft).p_roles).toEqual(['DOCENTE'])
    expect(canManageProducts('PERSONAL')).toBe(true)
    expect(canManageAccounts('PERSONAL')).toBe(false)
    expect(canManageAccounts('ADMINISTRADOR')).toBe(true)
  })
  it('admite usuario admin sin correo personal', () => {
    expect(loginIdentity(' Admin ')).toBe(INTERNAL_ADMIN_EMAIL)
    expect(loginIdentity('docente@example.edu.ec')).toBe('docente@example.edu.ec')
    expect(() => loginIdentity('usuario-desconocido')).toThrow()
  })
})
