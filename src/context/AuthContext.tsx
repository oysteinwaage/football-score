import {
  GoogleAuthProvider,
  OAuthProvider,
  User,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { onValue, ref } from 'firebase/database'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ReactNode } from 'react'

import { auth, database, firebaseConfigError, isFirebaseConfigured } from '../firebase/config'
import { UserProfile } from '../types/domain'
import { createUserProfile, declineUserPhotoUrl, saveUserPhotoUrl } from '../services/userService'
import { normalizeUserProfile } from '../utils/normalizeRecords'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  profileMissing: boolean
  initializing: boolean
  firebaseReady: boolean
  configError: string | null
  photoUrlPending: boolean
  signInWithGoogle: () => Promise<void>
  signInWithMicrosoft: () => Promise<void>
  signOutUser: () => Promise<void>
  completeOnboarding: (parentName: string, childName: string, teamIds: string[]) => Promise<void>
  acceptPhotoUrl: () => Promise<void>
  declinePhotoUrl: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileMissing, setProfileMissing] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!auth || !database) {
      setAuthLoading(false)
      setProfileLoading(false)
      return undefined
    }

    void setPersistence(auth, browserLocalPersistence)

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!database || !user) {
      setProfile(null)
      setProfileMissing(false)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)

    const unsubscribe = onValue(
      ref(database, `users/${user.uid}`),
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile(normalizeUserProfile(snapshot.val(), user.uid))
          setProfileMissing(false)
        } else {
          setProfile(null)
          setProfileMissing(true)
        }
        setProfileLoading(false)
      },
      () => {
        setProfile(null)
        setProfileMissing(false)
        setProfileLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user])

  const photoUrlPending = Boolean(
    user?.photoURL &&
    profile?.approved &&
    !profile.photoUrl &&
    !profile.declinedPhotoUrl,
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      profileMissing,
      initializing: authLoading || profileLoading,
      firebaseReady: isFirebaseConfigured,
      configError: firebaseConfigError,
      photoUrlPending,
      acceptPhotoUrl: async () => {
        if (!user?.photoURL) return
        await saveUserPhotoUrl(user.uid, user.photoURL)
      },
      declinePhotoUrl: async () => {
        if (!user) return
        await declineUserPhotoUrl(user.uid)
      },
      signInWithGoogle: async () => {
        if (!auth) {
          throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
        }

        const provider = new GoogleAuthProvider()
        await signInWithPopup(auth, provider)
      },
      signInWithMicrosoft: async () => {
        if (!auth) {
          throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
        }

        const provider = new OAuthProvider('microsoft.com')
        await signInWithPopup(auth, provider)
      },
      signOutUser: async () => {
        if (!auth) {
          throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
        }

        await signOut(auth)
      },
      completeOnboarding: async (parentName: string, childName: string, teamIds: string[]) => {
        if (!user) {
          throw new Error('Du må være logget inn for å fullføre registreringen.')
        }

        const nextProfile = await createUserProfile(user, parentName, childName, teamIds)
        setProfile(nextProfile)
        setProfileMissing(false)
      },
    }),
    [authLoading, photoUrlPending, profile, profileLoading, profileMissing, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth må brukes inni AuthProvider.')
  }

  return context
}
