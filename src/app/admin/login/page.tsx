import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff/dal";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  if (await getStaffSession()) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold tracking-tight">Casa Playa</h1>
      <p className="mt-1 text-sm text-neutral-600">Διαχείριση κρατήσεων</p>
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
    </main>
  );
}
