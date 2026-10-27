export const DOCTOR_IDS = ["D1", "D2"] as const;



export interface CheckInBody {
  name: string;
  age: number;
  kind: "appointment" | "walk_in";
  emergency?: boolean;
  appointmentTime?: string;
}

export interface CheckInResult {
  token: string;
  name: string;
  queueKind: string;
  convertedToWalkIn: boolean;
}

export interface CallNextResult {
  patient: { token: string; name: string; queueKind: string } | null;
}

export interface NoShowResult {
  outcome: "requeued" | "left";
}

export interface PatientSummary {
  age: number;
  checkedInAt: string;
  appointmentTime: string | null;
}

export interface QueueView {
  nowServing: (PatientSummary & {
    doctorId: string;
    token: string;
    name: string;
  })[];
  waiting: (PatientSummary & {
    position: number;
    token: string;
    name: string;
    estimatedWaitMinutes: number;
  })[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new ApiError("Can't reach the clinic server. Check the connection.", 0);
  }

  if (res.status >= 500) {
    throw new ApiError("The clinic server is unavailable right now.", res.status);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error ?? "Something went wrong.", res.status, body.fields);
  }
  return body as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export const getQueue = () => request<QueueView>("/queue");

export const checkIn = (body: CheckInBody) =>
  request<CheckInResult>("/check-ins", { method: "POST", body: JSON.stringify(body) });

export const callNext = (doctorId: string) =>
  request<CallNextResult>(`/doctors/${doctorId}/call-next`, { method: "POST" });

export const finishPatient = (doctorId: string) =>
  request<unknown>(`/doctors/${doctorId}/done`, { method: "POST" });

export const markNoShow = async (doctorId: string) => {
  const result = await request<NoShowResult>(
    `/doctors/${doctorId}/no-show`,
    { method: "POST" }
  );

  console.log("No-show API response:", result);

  return result;
};