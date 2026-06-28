"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export default function AppUserNav() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur px-4 py-2 flex justify-end items-center gap-3 text-sm shrink-0 min-h-[3rem]">
      {!isLoaded ? (
        <span className="text-zinc-500 text-xs" aria-hidden>
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
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Sign in
          </button>
        </SignInButton>
      )}
    </header>
  );
}
