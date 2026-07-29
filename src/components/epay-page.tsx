"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Brand } from "@/lib/payment-brands";

// A faithful replica of the Euronet Merchant Services hosted payment page as
// specified in Redirection Manual Ver 3.1, pages 6–10: card payment, IRIS
// (method choice, bank list, QR code) and Google Pay. Labels are the manual's
// own wording in both languages.
//
// This is a stand-in used while PAYCENTER_MODE=mock. It matches the real page's
// LAYOUT so nothing is a surprise at go-live, but it deliberately does not
// behave like it: the card fields are inert and accept nothing, because a page
// that both looks like a bank page and takes card numbers is a phishing target
// regardless of who deployed it. The caller renders a test banner above it.
//
// Bank wordmarks and the Google Pay mark are drawn as text: the manual's icon
// pack ships the card-scheme, epay and IRIS artwork (all used here as supplied)
// but not those, and approximating someone's logo is worse than naming it.

export type EpayMethod = "card" | "iris" | "gpay";
type IrisView = "choose" | "bank" | "qr";

/** The banks IRIS offers, in the order the manual's screenshot lists them. */
const IRIS_BANKS = [
  "Piraeus",
  "National Bank of Greece",
  "Eurobank",
  "Alpha Bank",
  "CrediaBank",
  "viva.com",
  "Optima bank",
  "Συνεταιριστική Τράπεζα Χανίων",
];

export interface EpayPageProps {
  merchantName: string;
  /** Pre-formatted the way the payment page shows it, e.g. `€1,00`. */
  amount: string;
  /** Where "Ακύρωση" goes — the registered Backlink URL plus ParamBackLink. */
  cancelUrl: string;
  /** Where the outcome forms POST — our registered Success/Failure URL. */
  callbackUrl: string;
  successFields: Record<string, string>;
  cardBrands: Brand[];
  secureBrands: Brand[];
  epayLogo: Brand;
  irisLogo: Brand;
}

// ── Icons drawn to match the manual's screenshots ────────────────────

function CardIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" fill="none" className={className} aria-hidden>
      <rect
        x="1"
        y="1"
        width="30"
        height="22"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M1 8h30" stroke="currentColor" strokeWidth="2" />
      <rect x="5" y="13" width="7" height="4" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function BankIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M2 9 12 3l10 6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 10v8M9 10v8M15 10v8M19.5 10v8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M2 20h20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function QrIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Z" />
      <path d="M14 14h2v2h-2v-2Zm3 0h2v2h-2v-2Zm2 3h2v2h-2v-2Zm-5 0h2v2h-2v-2Zm3 2h2v2h-2v-2Zm-3 0h-1v2h3v-2h-2Z" />
    </svg>
  );
}

/** The dark-blue "!" bubble the payment page puts next to CVV and Email. */
function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#1a1a6b" />
      <rect x="9" y="4.5" width="2" height="7" rx="1" fill="#fff" />
      <circle cx="10" cy="14.5" r="1.2" fill="#fff" />
    </svg>
  );
}

/** The little "where is my CVV" card hint. */
function CvvHintIcon() {
  return (
    <svg viewBox="0 0 34 20" className="h-4 w-7 shrink-0" aria-hidden>
      <rect
        x="0.75"
        y="3.75"
        width="26.5"
        height="14.5"
        rx="2.5"
        fill="#fff"
        stroke="#4a4a6a"
        strokeWidth="1.5"
      />
      <rect x="0.75" y="7" width="26.5" height="3" fill="#4a4a6a" />
      <circle cx="26" cy="9" r="7" fill="#1a1a6b" />
      <text
        x="26"
        y="12"
        textAnchor="middle"
        fontSize="7"
        fill="#fff"
        fontFamily="sans-serif"
      >
        123
      </text>
    </svg>
  );
}

/** Google Pay wordmark stand-in — see the note at the top of the file. */
function GooglePayMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-medium ${className}`}>
      <span className="text-[#4285F4]">G</span>
      <span className="ml-1">Pay</span>
    </span>
  );
}

// ── Shared chrome ────────────────────────────────────────────────────

function MarkRow({ brands, height }: { brands: Brand[]; height: number }) {
  return (
    <>
      {brands.map((brand) => (
        <Image
          key={brand.src}
          src={brand.src}
          alt={brand.alt}
          width={brand.width}
          height={brand.height}
          style={{ height, width: "auto" }}
          unoptimized
        />
      ))}
    </>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-8 flex items-center gap-4">
      <span className="h-px flex-1 bg-neutral-200" />
      <span className="text-[15px] font-bold text-[#2b2b5f]">{label}</span>
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}

function GreyButton({
  children,
  href,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const style = `rounded-full bg-[#b9b9b9] px-10 py-3 text-center text-[15px] font-bold text-[#1a1a2e] transition hover:bg-[#adadad] ${className}`;
  return href ? (
    <a href={href} className={style}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={style}>
      {children}
    </button>
  );
}

/**
 * The "Πληρωμή"/"Συνέχεια" button. On the real page this is where the card is
 * charged; here it POSTs the approved response straight to our registered
 * Success URL, so the HashKey verification downstream is the production one.
 */
function OutcomeForm({
  action,
  fields,
  paymentMethod,
  label,
  className,
  disabled = false,
}: {
  action: string;
  fields: Record<string, string>;
  /** §5 `PaymentMethod`, so the stored payment records how it was paid. */
  paymentMethod: string;
  label: React.ReactNode;
  className: string;
  disabled?: boolean;
}) {
  return (
    <form action={action} method="post" className="contents">
      {Object.entries({ ...fields, PaymentMethod: paymentMethod }).map(
        ([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ),
      )}
      <button type="submit" disabled={disabled} className={className}>
        {label}
      </button>
    </form>
  );
}

// ── The page ─────────────────────────────────────────────────────────

export function EpayPage(props: EpayPageProps) {
  const t = useTranslations("epayPage");
  const [method, setMethod] = useState<EpayMethod>("card");
  const [irisView, setIrisView] = useState<IrisView>("choose");
  const [bank, setBank] = useState<string | null>(null);

  const heading =
    method === "card"
      ? t("cardPayment")
      : method === "iris"
        ? t("irisPayment")
        : t("googlePayPayment");

  function choose(next: EpayMethod) {
    setMethod(next);
    setIrisView("choose");
    setBank(null);
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-8">
      <p className="text-[15px] text-[#2b2b5f] underline underline-offset-4">
        {heading}
      </p>

      {/* Έμπορος / Ποσό συναλλαγής */}
      <dl className="mt-6 space-y-2 text-[15px] font-bold text-[#2b2b5f]">
        <div className="flex justify-between gap-4">
          <dt>{t("merchant")}</dt>
          <dd className="text-right uppercase">{props.merchantName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t("transactionAmount")}</dt>
          <dd className="text-right">{props.amount}</dd>
        </div>
      </dl>

      <Divider label={t("choosePaymentMethod")} />

      {/* The three circular method chips */}
      <div className="mt-6 flex items-center justify-center gap-5">
        <MethodChip
          selected={method === "card"}
          onClick={() => choose("card")}
          label={t("methodCard")}
        >
          <CardIcon className="h-7 w-9 text-[#1a1a2e]" />
        </MethodChip>

        <MethodChip
          selected={method === "iris"}
          onClick={() => choose("iris")}
          label={t("methodIris")}
        >
          <Image
            src={props.irisLogo.src}
            alt={props.irisLogo.alt}
            width={props.irisLogo.width}
            height={props.irisLogo.height}
            style={{ height: 22, width: "auto" }}
            unoptimized
          />
        </MethodChip>

        <MethodChip
          selected={method === "gpay"}
          onClick={() => choose("gpay")}
          label={t("methodGooglePay")}
        >
          <GooglePayMark className="text-[15px] text-[#3c4043]" />
        </MethodChip>
      </div>

      {method === "card" && <CardScreen {...props} />}

      {method === "iris" && (
        <IrisScreens
          {...props}
          view={irisView}
          setView={setIrisView}
          bank={bank}
          setBank={setBank}
        />
      )}

      {method === "gpay" && <GooglePayScreen {...props} />}

      <div className="mt-10 flex justify-center">
        <Image
          src={props.epayLogo.src}
          alt={props.epayLogo.alt}
          width={props.epayLogo.width}
          height={props.epayLogo.height}
          style={{ height: 42, width: "auto" }}
          unoptimized
        />
      </div>
    </div>
  );
}

function MethodChip({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white transition ${
        selected
          ? "border-2 border-[#3b3bd6] shadow-none"
          : "border border-neutral-100 shadow-[0_2px_10px_rgba(0,0,0,0.10)]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Page 6: card payment ─────────────────────────────────────────────

function CardScreen({
  amount,
  cancelUrl,
  callbackUrl,
  successFields,
  cardBrands,
  secureBrands,
}: EpayPageProps) {
  const t = useTranslations("epayPage");

  // Inert on purpose — see the note at the top of the file.
  const field =
    "w-full rounded-full border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-[15px] text-neutral-500";

  return (
    <>
      <div className="mt-8 space-y-5">
        <Row label={`${t("cardNumber")} *`}>
          <input className={field} disabled aria-disabled />
        </Row>

        <Row label={`${t("expiryAndCvv")}*`}>
          <div className="flex items-center gap-2">
            <input
              className={`${field} max-w-[150px]`}
              placeholder={t("expiryPlaceholder")}
              disabled
              aria-disabled
            />
            <input
              className={`${field} max-w-[90px]`}
              aria-label={t("cvv")}
              disabled
              aria-disabled
            />
            <CvvHintIcon />
            <InfoIcon />
          </div>
        </Row>

        <Row
          label={t("cardholderName")}
          hint={t("cardholderNameHint")}
        >
          <input className={field} disabled aria-disabled />
        </Row>

        <Row label={t("email")}>
          <div className="flex items-center gap-2">
            <input className={field} disabled aria-disabled />
            <InfoIcon />
          </div>
        </Row>
      </div>

      <p className="mt-7 text-[13px] text-[#2b2b5f]">{t("requiredFields")}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#2b2b5f]">
        {t.rich("disclaimer", {
          privacy: (chunks) => (
            <a
              href="https://www.epayworldwide.gr/privacy-policy/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      {/* §8 marks, exactly as the payment page shows them */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <MarkRow brands={cardBrands} height={22} />
        <MarkRow brands={secureBrands} height={26} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GreyButton href={cancelUrl}>{t("cancel")}</GreyButton>
        <OutcomeForm
          action={callbackUrl}
          fields={successFields}
          paymentMethod="Card"
          label={t("pay", { amount })}
          className="rounded-full bg-[#1a1a8c] px-10 py-3 text-[15px] font-bold text-white transition hover:bg-[#16167a]"
        />
      </div>
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="pt-2 sm:w-[190px] sm:shrink-0">
        <span className="text-[15px] font-bold text-[#2b2b5f]">{label}</span>
        {hint && (
          <span className="block text-[13px] font-normal text-[#2b2b5f]">
            {hint}
          </span>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Pages 7–9: IRIS ──────────────────────────────────────────────────

function IrisScreens({
  cancelUrl,
  callbackUrl,
  successFields,
  irisLogo,
  view,
  setView,
  bank,
  setBank,
}: EpayPageProps & {
  view: IrisView;
  setView: (view: IrisView) => void;
  bank: string | null;
  setBank: (bank: string) => void;
}) {
  const t = useTranslations("epayPage");

  // Page 9: the QR screen replaces the whole body, method chips included.
  if (view === "qr") {
    return (
      <>
        <div className="mt-8 border-t border-neutral-200 pt-7">
          <h2 className="text-[17px] font-bold text-[#2b2b5f]">
            {t("qrTitle")}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#2b2b5f]">
            {t("qrLead")}
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <div className="relative flex h-56 w-56 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
            <Image
              src={irisLogo.src}
              alt={irisLogo.alt}
              width={irisLogo.width}
              height={irisLogo.height}
              style={{ height: 34, width: "auto" }}
              unoptimized
            />
          </div>
          <p className="mt-3 max-w-xs text-center text-[12px] text-neutral-500">
            {t("qrPlaceholder")}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <GreyButton onClick={() => setView("choose")}>{t("cancel")}</GreyButton>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Page 7: the two IRIS options */}
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IrisOption
          selected={view === "bank"}
          onClick={() => setView("bank")}
          icon={<BankIcon className="h-7 w-7 text-[#4a4a6a]" />}
          title={t("bankOption")}
          hint={t("bankOptionHint")}
        />
        <IrisOption
          selected={false}
          onClick={() => setView("qr")}
          icon={<QrIcon className="h-7 w-7 text-[#4a4a6a]" />}
          title={t("qrOption")}
          hint={t("qrOptionHint")}
        />
      </div>

      {/* Page 8: the bank grid */}
      {view === "bank" && (
        <>
          <p className="mt-5 text-[14px] leading-relaxed text-[#2b2b5f]">
            {t("bankSelectLead")}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {IRIS_BANKS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setBank(name)}
                aria-pressed={bank === name}
                className={`flex h-24 items-center justify-center rounded-xl bg-white px-3 text-center text-[13px] font-semibold text-[#2b2b5f] transition ${
                  bank === name
                    ? "border-2 border-[#3b3bd6]"
                    : "border border-neutral-100 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GreyButton href={cancelUrl}>{t("cancel")}</GreyButton>
            <OutcomeForm
              action={callbackUrl}
              fields={successFields}
              paymentMethod="IRIS"
              disabled={!bank}
              label={t("continue")}
              className="rounded-full bg-[#6b5ce7] px-10 py-3 text-[15px] font-bold text-white transition hover:bg-[#5b4cd6] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </>
      )}

      {view === "choose" && (
        <div className="mt-8 flex justify-center">
          <GreyButton href={cancelUrl}>{t("cancel")}</GreyButton>
        </div>
      )}
    </>
  );
}

function IrisOption({
  selected,
  onClick,
  icon,
  title,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-3 rounded-xl bg-white px-4 py-4 text-left transition ${
        selected
          ? "border-2 border-[#3b3bd6]"
          : "border border-neutral-100 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
      }`}
    >
      {icon}
      <span>
        <span className="block text-[15px] font-bold text-[#2b2b5f]">
          {title}
        </span>
        <span className="block text-[13px] text-neutral-500">{hint}</span>
      </span>
    </button>
  );
}

// ── Page 10: Google Pay ──────────────────────────────────────────────

function GooglePayScreen({
  cancelUrl,
  callbackUrl,
  successFields,
}: EpayPageProps) {
  const t = useTranslations("epayPage");

  return (
    <div className="mt-10 flex flex-col items-center gap-6">
      <OutcomeForm
        action={callbackUrl}
        fields={successFields}
        paymentMethod="GooglePay"
        label={
          <>
            {t("googlePayButton")} <GooglePayMark className="text-white" />
          </>
        }
        className="flex min-w-[280px] items-center justify-center gap-2 rounded-full bg-black px-10 py-4 text-[16px] font-medium text-white transition hover:bg-neutral-800"
      />
      <GreyButton href={cancelUrl}>{t("cancel")}</GreyButton>
    </div>
  );
}
