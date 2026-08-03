import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

// The logo and the cream band are taken from the existing booking engine at
// casaplaya.travelotopos.com, so a customer arriving from casaplaya.gr lands on
// something recognisable rather than on an unbranded page.
//
// #F0EAE2 is that site's own value, read out of its stylesheet rather than
// guessed from a screenshot; it uses the same colour for its header and footer.
//
// Deliberately nothing else here: the legacy header also carries a date picker
// and a "Banana Casa Playa" filter, which belong to its own booking flow and
// would be dead controls on ours.

export async function SiteHeader() {
  const t = await getTranslations("common");

  return (
    <header className="bg-[#F0EAE2]">
      <div className="mx-auto flex max-w-5xl items-center px-6 py-3">
        <Link href="/" aria-label={t("brand")}>
          {/* The source file is 103×81. Rendered at its natural size so it
              stays sharp — see the note in the header commit about asking the
              client for a larger original before this grows. */}
          <Image
            src="/casa-playa-logo.png"
            alt={t("brand")}
            width={103}
            height={81}
            priority
            className="h-14 w-auto"
          />
        </Link>

        {/* Where the legacy engine puts it, and where a visitor who cannot read
            the page will look first. */}
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
