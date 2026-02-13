import { auth as clerkAuth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server';
import { auth as authJsAuth } from '../../auth';
import { getAuthProvider } from './provider';

export async function getCurrentUserId() {
  if (getAuthProvider() === 'authjs') {
    const session = await authJsAuth();
    return session?.user?.id || null;
  }

  const { userId } = await clerkAuth();
  return userId || null;
}

export async function getCurrentUserEmail() {
  if (getAuthProvider() === 'authjs') {
    const session = await authJsAuth();
    return session?.user?.email?.toLowerCase() || null;
  }

  const user = await clerkCurrentUser();
  return user?.primaryEmailAddress?.emailAddress?.toLowerCase() || null;
}

export async function getCurrentUser() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return { userId };
}
