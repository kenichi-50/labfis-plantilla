export const INTERNAL_ADMIN_EMAIL = 'admin@sigelab.invalid'
export function loginIdentity(value) {
  const input = value.trim()
  if (input.toLowerCase() === 'admin') return INTERNAL_ADMIN_EMAIL
  if (input.includes('@')) return input
  throw new Error('Ingresa tu correo electrónico o el usuario admin.')
}
