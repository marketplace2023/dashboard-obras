export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:3001/api'

export const AUTH_STORAGE_KEY = 'gestor-obras-auth'

export type AuthUser = {
  id: string
  email: string
  username: string
  tenant_id: string
  partner_id: string
  role: string
  roles: string[]
  entity_type: string
}

export type AuthSuccessPayload = {
  access_token: string
  user: AuthUser
}
