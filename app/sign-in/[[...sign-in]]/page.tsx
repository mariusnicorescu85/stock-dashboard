import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <SignIn forceRedirectUrl="/" />
    </main>
  );
}
