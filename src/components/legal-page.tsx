import { getTranslations } from "next-intl/server";

// Shared shell for the terms and privacy pages.
//
// The text lives in `messages/{el,en}.json` under the namespace, as a list of
// sections, so the client can replace the wording without touching a component
// — the two files are the only thing anyone has to edit.

export interface LegalSection {
  title: string;
  body: string[];
}

export async function LegalPage({ namespace }: { namespace: "terms" | "privacy" }) {
  const t = await getTranslations(namespace);
  const legal = await getTranslations("legal");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-neutral-600">{t("lead")}</p>

      {/* Remove this block, and `legal.draftNotice` from both message files,
          the moment the business signs off on the wording. */}
      <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {legal("draftNotice")}
      </p>

      {sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-neutral-600">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
