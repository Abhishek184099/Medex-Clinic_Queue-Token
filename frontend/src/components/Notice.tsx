import type { ReactNode } from "react";

const tones = {
  info: "bg-slate-100 text-slate-700",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border border-red-200 bg-red-50 text-red-700",
};

export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-base ${tones[tone]}`}
    >
      {children}
    </div>
  );
}