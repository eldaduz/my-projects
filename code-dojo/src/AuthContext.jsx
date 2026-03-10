import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const AuthContext = createContext(null)
const ADMIN_EMAIL = 'eldaduz@gmail.com'

async function loadUserProfile(uid) {
  const snapshot = await getDoc(doc(db, 'codeDojo_users', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (!firebaseUser) {
        setProfile(null)
        setLoading(false)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)
      setProfile(await loadUserProfile(firebaseUser.uid))
      setLoading(false)
      setProfileLoading(false)
    })

    return unsubscribe
  }, [])

  const refreshProfile = async (uid = user?.uid, { silent = false } = {}) => {
    if (!uid) return null
    if (!silent) setProfileLoading(true)
    const nextProfile = await loadUserProfile(uid)
    setProfile(nextProfile)
    if (!silent) setProfileLoading(false)
    return nextProfile
  }

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)

  const signup = async (email, password, displayName) => {
    const credentials = await createUserWithEmailAndPassword(auth, email, password)
    await updateFirebaseProfile(credentials.user, { displayName })
    await setDoc(doc(db, 'codeDojo_users', credentials.user.uid), {
      email,
      displayName,
      totalXp: 0,
      level: 1,
      levelName: 'White Belt',
      streak: 0,
      lastPracticeDate: null,
      bookmarks: [],
      theme: 'dark',
      hasApiKey: false,
      createdAt: serverTimestamp(),
    })
    await refreshProfile(credentials.user.uid)
    return credentials
  }

  const updateUserProfile = async (patch) => {
    if (!user) return
    setProfile((currentProfile) => (currentProfile ? { ...currentProfile, ...patch } : currentProfile))
    await setDoc(doc(db, 'codeDojo_users', user.uid), patch, { merge: true })
    if (patch.displayName && patch.displayName !== user.displayName) {
      await updateFirebaseProfile(user, { displayName: patch.displayName })
    }
    await refreshProfile(user.uid, { silent: true })
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      isAdmin: user?.email === ADMIN_EMAIL,
      login,
      signup,
      logout: () => signOut(auth),
      refreshProfile,
      updateUserProfile,
    }),
    [loading, profile, profileLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
