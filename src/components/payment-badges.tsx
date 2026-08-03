import Image from "next/image";
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

// Both rows live in the site footer, which is on the home page — that is where
// §8 is satisfied. They used to be repeated in a panel just above it, which is
// how the same card icons ended up on screen twice within a few centimetres.
