/** Friendly messages for Firebase Auth errors. Returns null when nothing should be shown (user cancelled). */
export function googleErrorMessage(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') return null;
  if (code === 'auth/unauthorized-domain') return 'Google sign-in is not enabled for this web address yet. Please use email for now.';
  if (code === 'auth/network-request-failed') return 'No connection. Check your internet and try again.';
  if (code === 'auth/account-exists-with-different-credential') return 'This email is already registered with a password. Sign in with email instead.';
  return 'Could not sign in with Google. Please try again or use email.';
}

export function emailAuthMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/weak-password':
      return 'Please choose a stronger password.';
    default:
      return 'Unable to continue. Please check your details and try again.';
  }
}
