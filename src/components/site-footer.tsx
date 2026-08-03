import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { business, venueAddressLines } from "@/lib/business";
import { AcceptedCards, SecureBadges } from "@/components/payment-badges";

// Deliberately the same shape as the footer on casaplaya.gr: cream band,
// centred, round badge on top, then the venue and how to reach it. Booking is
// moving in-house rather than to an outside partner, so the two sites should
// not look like they belong to different companies.
//
// What is added to that shape is what a payment site has to carry and a
// brochure site does not: the legal identity with the VAT number, links to the
// terms and the privacy policy, and the §8 card and 3-D Secure marks. Those are
// a condition of the live account, not decoration — see `payment-badges.tsx`.

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
      <path d="M3.7 1.2a1 1 0 0 1 1.4.3l1.3 2a1 1 0 0 1-.2 1.3l-.9.7a8 8 0 0 0 3.2 3.2l.7-.9a1 1 0 0 1 1.3-.2l2 1.3a1 1 0 0 1 .3 1.4l-1 1.4a2 2 0 0 1-2.3.7C6.6 11.2 3.3 8 1.6 3.8a2 2 0 0 1 .7-2.2l1.4-.4z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
      <path d="M1 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1l-7 4-7-4zm0 1.6V12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.6L8 9.6 1 5.6z" />
    </svg>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("footer");

  const links = [
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
    { href: "/security", label: t("security") },
  ];

  return (
    <footer className="mt-auto bg-[#F0EAE2] text-neutral-700">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <Image
          src="/casa-playa-badge.png"
          alt={business.brand}
          width={512}
          height={512}
          className="mx-auto h-20 w-20"
        />

        <div className="mt-5 font-semibold leading-relaxed text-neutral-800">
          <p>{business.brand}</p>
          {venueAddressLines().map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {business.phones.map((phone) => (
            <a
              key={phone}
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-2 hover:underline"
            >
              <PhoneIcon />
              {phone}
            </a>
          ))}
          <a
            href={`mailto:${business.email}`}
            className="inline-flex items-center gap-2 hover:underline"
          >
            <MailIcon />
            {business.email}
          </a>
        </div>

        <nav className="mt-6">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-neutral-800">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 flex flex-col items-center gap-3">
          <AcceptedCards height={24} />
          <SecureBadges height={26} />
        </div>

        {/* Required of a site that takes card payments: who is being paid,
            with the VAT number and the registered seat. */}
        <p className="mt-8 text-xs text-neutral-500">
          {business.legalName} · {t("vatNumber")} {business.vatNumber} ·{" "}
          {business.address.area}, {business.address.postalCode}{" "}
          {business.address.city}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {t("rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
