import { FieldValue } from 'firebase-admin/firestore'
import { getAdminServices, requireAdmin } from '../_firebaseAdmin.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const adminCheck = await requireAdmin(request)
    if (adminCheck.error) {
      return response.status(adminCheck.status).json({ error: adminCheck.error })
    }

    const { userId } = request.body || {}
    if (!userId) {
      return response.status(400).json({ error: 'userId is required.' })
    }

    const { adminDb } = getAdminServices()
    const profileRef = adminDb.doc(`codeDojo_users/${userId}`)
    const secretRef = adminDb.doc(`codeDojo_users/${userId}/secrets/apiKey`)

    await secretRef.delete().catch(() => {})
    await profileRef.set(
      {
        hasApiKey: false,
        keyUpdatedAt: FieldValue.delete(),
      },
      { merge: true },
    )

    return response.status(200).json({ ok: true })
  } catch (error) {
    console.error('Delete API key error:', error)
    return response.status(500).json({ error: error.message || 'Internal server error' })
  }
}
