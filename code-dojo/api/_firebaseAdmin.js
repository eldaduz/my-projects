import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const ADMIN_EMAIL = process.env.CODE_DOJO_ADMIN_EMAIL || 'eldaduz@gmail.com'

function ensureAdminApp() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    initializeApp({ credential: cert(serviceAccount) })
  }
}

export function getAdminServices() {
  ensureAdminApp()
  return {
    adminAuth: getAuth(),
    adminDb: getFirestore(),
  }
}

export async function requireAdmin(request) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Must be logged in.', status: 401 }
  }

  const idToken = authHeader.split('Bearer ')[1]
  const { adminAuth } = getAdminServices()
  const decodedToken = await adminAuth.verifyIdToken(idToken)

  if (decodedToken.email !== ADMIN_EMAIL) {
    return { error: 'Admin access required.', status: 403 }
  }

  return { decodedToken }
}
