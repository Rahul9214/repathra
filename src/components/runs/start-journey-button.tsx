"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";

import { startRunAction } from "@/app/runs/actions";
import { IconArrowRight } from "@/components/studio/icons";

export function StartJourneyButton({
  slug,
  versionNumber,
  className = "button button-primary button-sm",
  label,
}: {
  slug: string;
  versionNumber: number;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonLabel = label ?? `Start Journey (v${versionNumber})`;

  if (isLoaded && !isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button type="button" className={className}>
          <span>{buttonLabel}</span>
          <IconArrowRight />
        </button>
      </SignInButton>
    );
  }

  async function handleStart() {
    setPending(true);
    setError(null);
    try {
      const res = await startRunAction(slug, versionNumber);
      if (!res.ok) {
        setError(res.message);
        setPending(false);
        return;
      }
      router.push(`/runs/${res.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start journey run.");
      setPending(false);
    }
  }

  return (
    <div className="start-journey-wrap">
      <button
        type="button"
        className={className}
        onClick={handleStart}
        disabled={pending}
      >
        <span>{pending ? "Initializing Run…" : buttonLabel}</span>
        <IconArrowRight />
      </button>
      {error ? (
        <p className="start-journey-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
