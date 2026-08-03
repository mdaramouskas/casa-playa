"use client";

import { useActionState } from "react";
import { reschedule, type ActionState } from "../../actions";

const initial: ActionState = {};

export function RescheduleForm({
  reference,
  current,
  min,
  max,
}: {
  reference: string;
  current: string;
  /** Bounds are hints only — `reschedule` re-checks the policy server-side. */
  min: string;
  max: string;
}) {
  const [state, formAction, pending] = useActionState(reschedule, initial);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="reference" value={reference} />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-600">
          Νέα ημερομηνία
        </span>
        <input
          type="date"
          name="date"
          defaultValue={current}
          min={min}
          max={max}
          required
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-900 px-4 py-2.5 font-medium text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        {pending ? "Αλλαγή…" : "Αλλαγή ημερομηνίας"}
      </button>

      {state.error && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.ok}
        </p>
      )}
    </form>
  );
}
