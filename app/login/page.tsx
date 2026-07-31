import { LoginPanel } from "@/components/login-panel";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error === "owner_only"
    ? "This workspace is restricted to its owner."
    : error === "auth_failed"
      ? "The sign-in link could not be verified. Request a new one."
      : "";
  return <LoginPanel initialMessage={message} />;
}
