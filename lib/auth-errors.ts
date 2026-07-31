type AuthErrorLike = {
  message?: string;
  status?: number;
};

export function getAuthSignInErrorMessage(error: AuthErrorLike) {
  const message = error.message?.toLowerCase() ?? "";

  if (error.status === 429 || message.includes("rate limit")) {
    return "New sign-in emails are temporarily paused. Use the newest Aurelian email already in your inbox, or try again in about an hour.";
  }

  return "We could not send a sign-in email. Please wait a moment and try again.";
}
