import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <SignUp forceRedirectUrl="/" />
    </main>
  );
}
