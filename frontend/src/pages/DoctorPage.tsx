import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  callNext,
  DOCTOR_IDS,
  errorMessage,
  finishPatient,
  markNoShow,
} from "../api/clinic";
import { Notice } from "../components/Notice";
import { QueueState } from "../components/QueueState";
import { useQueue } from "../hooks/useQueue";
import {
  buttonClass,
  dangerButtonClass,
  secondaryButtonClass,
} from "../styles";
import { PatientDetails } from "../components/PatientDetails";

export function DoctorPickerPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Choose doctor</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {DOCTOR_IDS.map((id) => (
          <Link key={id} to={`/doctor/${id}`} className={buttonClass}>
            Doctor {id}
          </Link>
        ))}
      </div>
    </section>
  );
}

type Message = { tone: "info" | "error"; text: string };

export default function DoctorPage() {
  const { doctorId = "" } = useParams();
  const { data, error, refresh } = useQueue(3000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  if (!DOCTOR_IDS.includes(doctorId as (typeof DOCTOR_IDS)[number])) {
    return (
      <Notice tone="error">
        Unknown doctor. <Link className="underline" to="/doctor">Choose a doctor</Link>
      </Notice>
    );
  }

  // Runs one button action, shows its result, then refreshes the queue.
  async function run(task: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: "info", text: await task() });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const callPatient = async () => {
    const { patient } = await callNext(doctorId);
    return patient ? `Calling ${patient.token}, ${patient.name}.` : "Nobody is waiting.";
  };

  const finishCurrent = async () => {
    await finishPatient(doctorId);
    return "Marked as done.";
  };

  const noShowCurrent = async () => {
    const { outcome } = await markNoShow(doctorId);
    return outcome === "requeued"
      ? "No-show. The patient is back in the walk-in queue."
      : "Second no-show. The patient has left the queue.";
  };

  return (
    <QueueState data={data} error={error}>
      {(view) => {
        const current = view.nowServing.find((c) => c.doctorId === doctorId) ?? null;

        return (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold">Doctor {doctorId}</h1>

            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-base text-slate-500">With you now</p>
                         {current ? (
                <>
                  <p className="mt-2 text-5xl font-black sm:text-6xl">{current.token}</p>
                  <p className="mt-2 text-2xl">{current.name}</p>
                  <div className="mx-auto mt-4 w-fit text-left">
                    <PatientDetails patient={current} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xl text-slate-500">No patient. Press Call next.</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                className={buttonClass}
                disabled={busy || current !== null}
                onClick={() => run(callPatient)}
              >
                Call next
              </button>
              <button
                className={secondaryButtonClass}
                disabled={busy || !current}
                onClick={() => run(finishCurrent)}
              >
                Done
              </button>
              <button
                className={dangerButtonClass}
                disabled={busy || !current}
                onClick={() => run(noShowCurrent)}
              >
                No-show
              </button>
            </div>

            {message && <Notice tone={message.tone === "error" ? "error" : "success"}>{message.text}</Notice>}
          </section>
        );
      }}
    </QueueState>
  );
}