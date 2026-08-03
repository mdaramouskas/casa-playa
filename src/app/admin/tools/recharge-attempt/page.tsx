import Link from "next/link";
import { getPaycenterConfig } from "@/lib/paycenter/config";
import { requireStaff } from "@/lib/staff/dal";
import { AdminHeader } from "../../admin-header";
import { RechargeAttemptForm } from "./recharge-attempt-form";

// Test case 3 of the Redirection manual (§7), which is mandatory before Euronet
// grants a live account and is the only one of the three that cannot be
// produced through the customer-facing flow.

export const dynamic = "force-dynamic";

export default async function RechargeAttemptPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await requireStaff();
  const { ref } = await searchParams;
  const mode = getPaycenterConfig().mode;

  return (
    <>
      <AdminHeader session={session} />

      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <Link href="/admin" className="text-sm text-sky-800 hover:underline">
          ← Πίσω στις κρατήσεις
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Test case 3 — απόπειρα διπλοχρέωσης
        </h1>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm leading-relaxed text-neutral-700">
          <p>
            Το τρίτο υποχρεωτικό test case της Euronet ζητάει να σταλεί αίτημα με
            κωδικό συναλλαγής που <strong>ανήκει ήδη σε εγκεκριμένη πληρωμή</strong>.
            Η αναμενόμενη απάντηση είναι <code>ResultCode=1048</code> στο URL
            αποτυχίας.
          </p>
          <p className="mt-3">
            Η εφαρμογή δεν το κάνει αυτό από μόνη της, και σωστά: η σελίδα
            μετάβασης ανακατευθύνει αντί να ξαναστείλει όταν η πληρωμή έχει
            ολοκληρωθεί, και κάθε κράτηση παίρνει νέο κωδικό. Αυτή η σελίδα είναι
            η μοναδική πόρτα εκτός εκείνης της ροής, ανοιχτή μόνο στο προσωπικό
            και μόνο σε λειτουργία <code>test</code>.
          </p>
          <p className="mt-3">
            Η αρχική πληρωμή <strong>δεν πειράζεται</strong>. Όταν έρθει η
            απάντηση, ο κώδικας βλέπει ότι η συναλλαγή έχει ήδη διεκπεραιωθεί,
            γράφει προειδοποίηση στα logs και δεν αλλάζει τίποτα — αυτό ακριβώς
            ζητάει το §7 να αποδείξουμε.
          </p>
        </div>

        {mode === "test" ? (
          <RechargeAttemptForm defaultReference={ref} />
        ) : (
          <p className="mt-6 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
            Η λειτουργία πληρωμών είναι <strong>{mode}</strong>. Το εργαλείο
            ενεργοποιείται μόνο με <code>PAYCENTER_MODE=test</code> και τα
            credentials της Euronet — σε <code>live</code> είναι μονίμως κλειστό,
            γιατί θα παρήγαγε πραγματική δεύτερη χρέωση.
          </p>
        )}

        <h2 className="mt-10 font-semibold">Και τα τρία υποχρεωτικά τεστ</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Ίδια κάρτα <span className="font-mono">4908455555555557</span>, CVV2{" "}
          <span className="font-mono">123</span>, οποιοδήποτε μελλοντικό έτος. Ο
          μήνας λήξης επιλέγει το σενάριο.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Λήξη</th>
                <th className="px-4 py-3">Σενάριο</th>
                <th className="px-4 py-3">Αναμενόμενη απάντηση</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[
                ["01", "Έγκριση (VISA)", "ResultCode=0, ResponseCode=00 → success URL"],
                ["02", "Απόρριψη", "ResultCode=0, ResponseCode=12 → failure URL"],
                ["03", "Διπλοχρέωση", "ResultCode=1048 → failure URL"],
              ].map(([month, scenario, expected]) => (
                <tr key={month}>
                  <td className="px-4 py-3 font-mono font-semibold">{month}</td>
                  <td className="px-4 py-3">{scenario}</td>
                  <td className="px-4 py-3 text-neutral-600">{expected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
