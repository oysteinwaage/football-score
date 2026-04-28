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

async function fetchMsProfilePhoto(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/photos/96x96/$value', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
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
  const [msPendingPhotoUrl, setMsPendingPhotoUrl] = useState<string | null>(null)

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
    (user?.photoURL || msPendingPhotoUrl) &&
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
        const photoUrl = user?.photoURL ?? msPendingPhotoUrl
        if (!photoUrl || !user) return
        await saveUserPhotoUrl(user.uid, photoUrl)
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
        provider.addScope('User.Read')
        const result = await signInWithPopup(auth, provider)
        const credential = OAuthProvider.credentialFromResult(result)
        if (credential?.accessToken) {
          const photoUrl = await fetchMsProfilePhoto(credential.accessToken)
          if (photoUrl) setMsPendingPhotoUrl(photoUrl)
        }
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

        const photoUrlOverride = user.photoURL ?? msPendingPhotoUrl ?? undefined
        const nextProfile = await createUserProfile(user, parentName, childName, teamIds, photoUrlOverride)
        setProfile(nextProfile)
        setProfileMissing(false)
      },
    }),
    [authLoading, msPendingPhotoUrl, photoUrlPending, profile, profileLoading, profileMissing, user],
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
