"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export default function AppUserNav() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 px-4 py-2 flex justify-end items-center gap-3 text-sm shrink-0 min-h-[3rem]">
      {!isLoaded ? (
        <span className="text-slate-500 text-xs" aria-hidden>
          …
        </span>
      ) : isSignedIn ? (
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      ) : (
        <SignInButton mode="redirect" forceRedirectUrl="/">
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Sign in
          </button>
        </SignInButton>
      )}
    </header>
  );
}
