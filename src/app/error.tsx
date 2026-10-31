"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="board">
      <section className="state-panel is-error" role="alert">
        <h2>The board stopped</h2>
        <p>Journey Studio hit an unexpected error. No change was confirmed.</p>
        <button className="button" type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
