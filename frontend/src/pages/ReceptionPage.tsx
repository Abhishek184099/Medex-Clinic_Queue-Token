import { useState, type FormEvent } from "react";
import {
  ApiError,
  checkIn,
  errorMessage,
  type CheckInBody,
} from "../api/clinic";
import { Field } from "../components/Field";
import { Notice } from "../components/Notice";
import { QueueState } from "../components/QueueState";
import { useQueue } from "../hooks/useQueue";
import { buttonClass, inputClass } from "../styles";
import { PatientDetails } from "../components/PatientDetails";

const CLINIC_OFFSET = "+05:45";

interface FormState {
  name: string;
  age: string;
  kind: "appointment" | "walk_in";
  emergency: boolean;
  appointmentAt: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  age: "",
  kind: "walk_in",
  emergency: false,
  appointmentAt: "",
};

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const age = Number(form.age);

  if (!form.name.trim()) errors.name = "Name is required.";
  if (form.age === "" || !Number.isInteger(age) || age < 0 || age > 120) {
    errors.age = "Age must be a whole number from 0 to 120.";
  }
  if (form.kind === "appointment" && !form.emergency && !form.appointmentAt) {
    errors.appointmentTime = "Choose the appointment time.";
  }
  return errors;
}

function toBody(form: FormState): CheckInBody {
  const body: CheckInBody = {
    name: form.name.trim(),
    age: Number(form.age),
    kind: form.kind,
    emergency: form.emergency,
  };
  if (form.kind === "appointment" && form.appointmentAt) {
    body.appointmentTime = `${form.appointmentAt}:00${CLINIC_OFFSET}`;
  }
  return body;
}

export default function ReceptionPage() {
  const { data, error, refresh } = useQueue(3000);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setServerError(null);

    const clientErrors = validate(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await checkIn(toBody(form));
      const late = result.convertedToWalkIn
        ? " Arrived late, so placed in the walk-in queue."
        : "";
      setSuccess(`Token ${result.token} issued to ${result.name}.${late}`);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Check in patient</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field label="Name" error={errors.name}>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label="Age" error={errors.age}>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </Field>

          <div className="space-y-1">
            <span className="text-base font-medium">Visit type</span>
            <div className="grid grid-cols-2 gap-2">
              {(["walk_in", "appointment"] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={form.kind === kind}
                  onClick={() => update("kind", kind)}
                  className={`min-h-12 rounded-xl border px-3 py-3 text-base font-medium ${
                    form.kind === kind
                      ? "border-sky-700 bg-sky-700 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {kind === "walk_in" ? "Walk-in" : "Appointment"}
                </button>
              ))}
            </div>
          </div>

          {form.kind === "appointment" && (
            <Field label="Appointment time" error={errors.appointmentTime}>
              <input
                className={inputClass}
                type="datetime-local"
                value={form.appointmentAt}
                onChange={(e) => update("appointmentAt", e.target.value)}
              />
            </Field>
          )}

          <label className="flex min-h-12 items-center gap-3 text-base">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={form.emergency}
              onChange={(e) => update("emergency", e.target.checked)}
            />
            Emergency (seen first)
          </label>

          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? "Checking in…" : "Check in"}
          </button>
        </form>

        {success && <Notice tone="success">{success}</Notice>}
        {serverError && <Notice tone="error">{serverError}</Notice>}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Live queue</h2>

        <QueueState data={data} error={error}>
          {(view) => (
            <>
              <div className="space-y-2">
                <p className="font-medium text-slate-600">Now with doctor</p>
                {view.nowServing.length === 0 && (
                  <p className="text-slate-500">No one is being seen.</p>
                )}
                {view.nowServing.map((c) => (
                  <div
                    key={c.doctorId}
                    className="rounded-xl bg-white p-4 shadow-sm"
                  >
                    <p className="text-lg">
                      <span className="font-bold">{c.token}</span> {c.name}{" "}
                      <span className="text-slate-500">({c.doctorId})</span>
                    </p>
                    <div className="mt-2">
                      <PatientDetails patient={c} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="font-medium text-slate-600">
                  Waiting ({view.waiting.length})
                </p>
                {view.waiting.length === 0 && (
                  <p className="text-slate-500">Nobody is waiting.</p>
                )}
                <ul className="space-y-2">
                  {view.waiting.map((p) => (
                    <li
                      key={p.token}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xl font-bold">{p.token}</p>
                        <p className="truncate text-slate-600">{p.name}</p>
                        <div className="mt-2">
                          <PatientDetails patient={p} />
                        </div>
                      </div>
                      <p className="shrink-0 text-right text-sm font-medium">
                        {p.estimatedWaitMinutes === 0
                          ? "Next"
                          : `~${p.estimatedWaitMinutes} min`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </QueueState>
      </section>
    </div>
  );
}
