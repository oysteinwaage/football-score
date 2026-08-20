import { push, ref, remove, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { FeedbackRecord, FeedbackType } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

export async function submitFeedback(userId: string, userName: string, type: FeedbackType, message: string): Promise<void> {
  const db = requireDatabase()
  const feedbackRef = push(ref(db, 'feedback'))
  const feedback: FeedbackRecord = {
    id: feedbackRef.key ?? '',
    userId,
    userName,
    type,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  }

  await set(feedbackRef, feedback)
}

export async function markFeedbackRead(feedbackId: string, read: boolean): Promise<void> {
  await update(ref(requireDatabase(), `feedback/${feedbackId}`), { read })
}

export async function deleteFeedback(feedbackId: string): Promise<void> {
  await remove(ref(requireDatabase(), `feedback/${feedbackId}`))
}
