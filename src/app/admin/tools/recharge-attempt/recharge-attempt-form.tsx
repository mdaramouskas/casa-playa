"use client";

import { useActionState } from "react";
import { startRechargeAttempt, type RechargeState } from "../../actions";

const initial: RechargeState = {};

export function RechargeAttemptForm({ defaultReference }: { defaultReference?: string }) {
  const [state, formAction, pending] = useActionState(
    startRechargeAttempt,
    initial,
  );

  // Once the ticket is issued, the second half of the test is a normal browser
  // POST to the bank's page. Deliberately NOT auto-submitting the way the real
  // handoff does: this form starts a double-charge attempt, so it should take a
  // conscious click rather than fire because someone opened a URL.
  if (state.submit) {
    return (
      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          Το ticket εκδόθηκε για τον ίδιο κωδικό. Πάτα για να σταλείς στη σελίδα
          της τράπεζας και βάλε την κάρτα{" "}
          <strong className="font-mono">4908455555555557</strong> με λήξη{" "}
          <strong>03</strong> / μελλοντικό έτος και CVV2{" "}
          <strong className="font-mono">123</strong>.
        </p>
        <form action={state.submit.action} method="POST" className="mt-4">
          {Object.entries(state.submit.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white transition hover:bg-amber-600"
          >
            Αποστολή στη σελίδα πληρωμής
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-600">
          Κωδικός ήδη πληρωμένης κράτησης
        </span>
        <input
          name="reference"
          defaultValue={defaultReference}
          required
          placeholder="CAPL.XXXXXXXXXX"
          className="w-64 rounded-lg border border-neutral-300 px-3 py-2 font-mono"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-900 px-4 py-2.5 font-medium text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        {pending ? "Έκδοση ticket…" : "Έκδοση ticket με τον ίδιο κωδικό"}
      </button>

      {state.error && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
