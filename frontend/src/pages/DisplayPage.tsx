import { DOCTOR_IDS } from "../api/clinic";
import { useFreshCalls } from "../hooks/useFreshCalls";
import { useQueue } from "../hooks/useQueue";

export default function DisplayPage() {
  const { data, error } = useQueue(2000);
  const fresh = useFreshCalls(data);

  if (error) {
    return (
      <Screen>
        <p className="text-4xl font-bold text-red-300 sm:text-6xl">Connection lost</p>
        <p className="mt-4 text-2xl sm:text-3xl">
          The queue can't be shown right now. Please wait for the reception desk.
        </p>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <p className="text-3xl sm:text-5xl">Loading…</p>
      </Screen>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-900 p-4 text-white sm:p-10">
      <h1 className="text-center text-3xl font-bold sm:text-5xl">Now serving</h1>

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {data.nowServing.length === 0 && (
          <li className="rounded-3xl bg-slate-800 p-8 text-center text-2xl sm:text-4xl">
            Please wait
          </li>
        )}

        {data.nowServing.map((c) => {
          const key = `${c.doctorId}:${c.token}`;
          const isFresh = fresh.has(key);
          return (
            <li
              key={key}
              className={`rounded-3xl p-6 text-center transition-colors duration-500 ${
                isFresh ? "bg-amber-400 text-slate-900" : "bg-slate-800"
              }`}
            >
              <p className="text-xl sm:text-3xl">Doctor {c.doctorId}</p>
              <p className="text-6xl font-black sm:text-8xl lg:text-9xl">{c.token}</p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 text-center text-xl text-slate-400 sm:text-3xl">Next</h2>
      <ul className="mt-4 flex flex-wrap justify-center gap-3">
        {data.waiting.slice(0, 6).map((p) => (
          <li key={p.token} className="rounded-xl bg-slate-800 px-5 py-3 text-2xl font-bold sm:text-4xl">
            {p.token}
          </li>
        ))}
      </ul>

      <p className="sr-only">Doctors: {DOCTOR_IDS.join(", ")}</p>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-900 p-6 text-center text-white">
      {children}
    </div>
  );
}