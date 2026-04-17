import type { Access } from 'payload'

export const isAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'admin'
}

export const isAdminOrEditor: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'admin' || user.role === 'editor'
}
