export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
        EZStreet
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Select an intersection and get a deterministic street-safety report —
        crash counts, injuries, and Priority Zone status sourced from NYC Open
        Data.
      </p>
    </main>
  );
}
