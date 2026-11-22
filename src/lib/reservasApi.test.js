import { describe, it, expect, vi } from 'vitest'
import { buildPeriod, periodFields, canReserve, canViewHistory, createReservasApi, reservationError } from './reservasApi'

describe('períodos y zona horaria de LABFIS', () => {
  it('valida campos vacíos, fechas imposibles y horarios inválidos', () => {
    for (const value of [
      { date: '', start: '09:00', end: '10:00' },
      { date: '2030-02-30', start: '09:00', end: '10:00' },
      { date: '2030-01-01', start: '10:00', end: '09:00' },
      { date: '2030-01-01', start: '09:00', end: '09:00' },
      { date: '2030-01-01', start: '24:00', end: '25:00' },
    ]) expect(() => buildPeriod(value)).toThrow()
  })
  it('envía horarios de Ecuador incluso desde otra zona del navegador', () => {
    expect(buildPeriod({ date: '2030-01-01', start: '09:00', end: '10:00' })).toEqual({ p_inicio: '2030-01-01T09:00:00-05:00', p_fin: '2030-01-01T10:00:00-05:00' })
    expect(periodFields('2030-01-02T02:15:00Z')).toEqual({ date: '2030-01-01', time: '21:15' })
  })
  it('separa facultades de estudiantes/docentes y personal', () => {
    expect(canReserve('DOCENTE')).toBe(true)
    expect(canReserve('ADMINISTRADOR')).toBe(true)
    expect(canViewHistory('PERSONAL')).toBe(true)
    expect(canViewHistory('ESTUDIANTE')).toBe(false)
  })
})

describe('contrato RPC', () => {
  it('descarta propietario, rol y estado inyectados al crear o modificar', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'reserva-1' }], error: null })
    const api = createReservasApi({ rpc })
    const period = { p_inicio: 'inicio', p_fin: 'fin' }
    expect(await api.create({ p_equipo_id: 'equipo', ...period, p_actividad: 'Actividad', usuario_id: 'ajeno', estado: 'CANCELADA', rol: 'ADMINISTRADOR' })).toEqual({ id: 'reserva-1' })
    expect(rpc).toHaveBeenLastCalledWith('reservas_crear', { p_equipo_id: 'equipo', ...period, p_actividad: 'Actividad' })
    await api.modify('reserva-1', { ...period, usuario_id: 'ajeno', estado: 'CANCELADA' })
    expect(rpc).toHaveBeenLastCalledWith('reservas_modificar', { p_reserva_id: 'reserva-1', ...period })
    await api.cancel('reserva-1')
    expect(rpc).toHaveBeenLastCalledWith('reservas_cancelar', { p_reserva_id: 'reserva-1' })
  })
  it('propaga el conflicto y no convierte errores del servicio en resultados vacíos', async () => {
    const error = { code: '23P01', message: 'conflicto' }
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    const api = createReservasApi({ rpc })
    await expect(api.create({})).rejects.toBe(error)
    await expect(api.availability({})).rejects.toBe(error)
    expect(reservationError(error)).toContain('reserva original se conserva')
  })
})
