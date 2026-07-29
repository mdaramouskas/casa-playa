import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  cardBrands,
  secureBrands,
  type Brand,
} from "@/lib/payment-brands";

// Redirection Manual §8. The card marks and the 3-D Secure marks are a
// condition of going live, so they are rendered from one place — if a scheme is
// added to the merchant agreement it appears everywhere at once.

function Marks({ brands, height }: { brands: Brand[]; height: number }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {brands.map((brand) => (
        <li key={brand.src} className="flex items-center">
          <Image
            src={brand.src}
            alt={brand.alt}
            width={brand.width}
            height={brand.height}
            style={{ height, width: "auto" }}
            unoptimized
          />
        </li>
      ))}
    </ul>
  );
}

/** The accepted-card row (§8, "Εικονίδια υποστηριζόμενων καρτών"). */
export function AcceptedCards({ height = 26 }: { height?: number }) {
  return <Marks brands={cardBrands()} height={height} />;
}

/** The strong-authentication row (§8, "Εικονίδια διαδικασίας 3D-Secure"). */
export function SecureBadges({ height = 34 }: { height?: number }) {
  return <Marks brands={secureBrands()} height={height} />;
}

/**
 * The block §8 requires on the home page: accepted cards plus the 3-D Secure
 * marks. `epay` and IRIS are optional there, so they are left to the footer.
 */
export async function PaymentTrustStrip() {
  const t = await getTranslations("payments");

  return (
    <section
      aria-labelledby="payment-trust-heading"
      className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <h2
        id="payment-trust-heading"
        className="text-sm font-semibold uppercase tracking-wide text-neutral-500"
      >
        {t("acceptedCards")}
      </h2>

      <div className="mt-4">
        <AcceptedCards />
      </div>

      <p className="mt-6 text-sm text-neutral-600">{t("secureNote")}</p>

      <div className="mt-4">
        <SecureBadges />
      </div>
    </section>
  );
}
