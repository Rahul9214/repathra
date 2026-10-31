import Link from "next/link";

export default function NotFound() {
  return (
    <main id="board">
      <section className="state-panel">
        <h2>That journey is not on the board</h2>
        <p>The slug or published version is not stored.</p>
        <Link href="/">All journeys</Link>
      </section>
    </main>
  );
}
