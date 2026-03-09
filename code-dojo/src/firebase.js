import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBkSxr6-aRTijkqEM4Tt0RPu3l-_tpVof0',
  authDomain: 'eldad-portfolio-apps.firebaseapp.com',
  projectId: 'eldad-portfolio-apps',
  storageBucket: 'eldad-portfolio-apps.firebasestorage.app',
  messagingSenderId: '948254639000',
  appId: '1:948254639000:web:8cfb410cccd39bcb6461ed',
  measurementId: 'G-9KKE7V1TC0',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
