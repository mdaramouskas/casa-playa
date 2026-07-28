"use client";

import { useEffect, useRef } from "react";

// Redirection §5: the customer reaches the payment page through an HTML form
// POST, so this cannot be a plain redirect. The form submits itself on mount;
// the button is the fallback if that is blocked. Frames are not allowed on this
// page (§9), so nothing here may be embedded.

export function AutoSubmitForm({
  action,
  fields,
  label,
}: {
  action: string;
  fields: Record<string, string>;
  label: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    form.current?.submit();
  }, []);

  return (
    <form ref={form} action={action} method="POST">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className="w-full rounded-lg bg-amber-500 px-6 py-3 font-medium text-white hover:bg-amber-600"
      >
        {label}
      </button>
    </form>
  );
}
