import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { addressLine, business } from "@/lib/business";
import { AcceptedCards } from "@/components/payment-badges";

// Present on every page, by way of the locale layout.
//
// Not decoration: the card-scheme rules require a site that takes payments to
// show who is being paid — legal name, VAT number, address, a way to reach them
// — plus reachable cancellation and privacy terms. It is part of what Euronet
// checks before issuing a live account (§8), so removing any of these blocks
// going live.

export async function SiteFooter() {
  const t = await getTranslations("footer");

  const legal = [
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
    { href: "/security", label: t("security") },
  ];

  return (
    <footer className="mt-auto border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 sm:grid-cols-2">
        <div>
          <p className="font-semibold">{business.legalName}</p>
          <p className="mt-2 text-sm text-neutral-600">
            {t("vatNumber")}: {business.vatNumber}
          </p>
          <p className="text-sm text-neutral-600">{addressLine()}</p>
          <p className="mt-2 text-sm text-neutral-600">
            {business.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="mr-3 hover:underline"
              >
                {phone}
              </a>
            ))}
          </p>
          <p className="text-sm text-neutral-600">
            <a href={`mailto:${business.email}`} className="hover:underline">
              {business.email}
            </a>
          </p>
        </div>

        <div className="sm:text-right">
          <nav>
            <ul className="space-y-2 text-sm">
              {legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-6 sm:flex sm:justify-end">
            <AcceptedCards height={22} />
          </div>
        </div>
      </div>
    </footer>
  );
}
