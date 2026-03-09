import { getAdminServices, requireAdmin } from '../_firebaseAdmin.js'

async function deleteCollectionDocs(collectionRef) {
  const snapshot = await collectionRef.get()
  if (snapshot.empty) return

  let batch = collectionRef.firestore.batch()
  let count = 0

  for (const documentSnapshot of snapshot.docs) {
    batch.delete(documentSnapshot.ref)
    count += 1

    if (count === 450) {
      await batch.commit()
      batch = collectionRef.firestore.batch()
      count = 0
    }
  }

  if (count > 0) {
    await batch.commit()
  }
}

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

    const { adminAuth, adminDb } = getAdminServices()

    await deleteCollectionDocs(adminDb.collection(`codeDojo_users/${userId}/submissions`))
    await deleteCollectionDocs(adminDb.collection(`codeDojo_users/${userId}/secrets`))

    await Promise.all([
      adminDb
        .doc(`codeDojo_users/${userId}`)
        .delete()
        .catch(() => {}),
      adminDb
        .doc(`codeDojo_leaderboard/${userId}`)
        .delete()
        .catch(() => {}),
      adminAuth.deleteUser(userId).catch((error) => {
        if (error.code !== 'auth/user-not-found') {
          throw error
        }
      }),
    ])

    return response.status(200).json({ ok: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return response.status(500).json({ error: error.message || 'Internal server error' })
  }
}
