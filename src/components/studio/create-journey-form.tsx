"use client";

import { useActionState, useState } from "react";

import { createJourneyAction, type StudioActionState } from "@/app/studio/actions";

export function CreateJourneyForm() {
  const [state, action, pending] = useActionState(createJourneyAction, null);
  const [slug, setSlug] = useState("");
  const [slugModified, setSlugModified] = useState(false);

  function handleTitleChange(value: string) {
    if (!slugModified) {
      const generated = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
      setSlug(generated);
    }
  }

  return (
    <form action={action} className="create-form" aria-busy={pending}>
      <div className="create-form-header">
        <h2>Define New Workflow</h2>
        <p>Initializes an operator journey draft ready for interactive step design.</p>
      </div>

      <label>
        Title
        <input
          name="title"
          required
          maxLength={140}
          placeholder="e.g. Identity Verification"
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      </label>

      <label>
        URL Identifier (Slug)
        <input
          name="slug"
          required
          minLength={3}
          maxLength={64}
          autoComplete="off"
          value={slug}
          placeholder="identity-verification"
          onChange={(e) => {
            setSlugModified(true);
            setSlug(e.target.value);
          }}
        />
      </label>

      <label>
        Operational Summary
        <textarea
          name="summary"
          required
          maxLength={400}
          rows={3}
          placeholder="Brief description of this workflow's objectives and handoffs."
        />
      </label>

      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Initializing…" : "Initialize Workflow"}
      </button>

      <ActionNote state={state} />
    </form>
  );
}

export function ActionNote({ state }: { state: StudioActionState | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "note is-ok" : "note is-error"} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}
