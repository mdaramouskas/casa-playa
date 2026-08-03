"use client";

import { useActionState } from "react";
import { login, type ActionState } from "../actions";

const initial: ActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Κωδικός</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-900 px-4 py-2.5 font-medium text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        {pending ? "Σύνδεση…" : "Σύνδεση"}
      </button>
    </form>
  );
}
