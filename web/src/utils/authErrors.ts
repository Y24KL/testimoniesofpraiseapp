/** Friendly messages for Firebase Auth errors on the email sign-in and sign-up forms. */
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
