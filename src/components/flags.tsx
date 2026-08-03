import type { Locale } from "@/i18n/routing";

// Drawn rather than served as images: seven flags at 20×14 would be seven more
// requests for 300 bytes of stripes each, and emoji flags are not an option —
// Windows ships no glyphs for them and renders "GB" as two letters instead.
//
// The frame is 3:2 in a 60×40 viewBox, so every flag is built on the same grid.
// A 1px inset border sits on top: white flags (France, Italy, Russia) would
// otherwise bleed into the cream header band.

type FlagProps = { className?: string };

function Frame({ children, className }: FlagProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 60 40"
      aria-hidden="true"
      className={className ?? "h-4 w-6 shrink-0 rounded-[2px]"}
    >
      {children}
      <rect
        x="0.5"
        y="0.5"
        width="59"
        height="39"
        fill="none"
        stroke="rgba(0,0,0,0.15)"
      />
    </svg>
  );
}

/** Nine stripes and the canton, at the official 5-stripe canton height. */
function GreekFlag(props: FlagProps) {
  return (
    <Frame {...props}>
      <rect width="60" height="40" fill="#0D5EAF" />
      {[1, 3, 5, 7].map((band) => (
        <rect
          key={band}
          y={(band * 40) / 9}
          width="60"
          height={40 / 9}
          fill="#fff"
        />
      ))}
      <rect width={(40 * 5) / 9} height={(40 * 5) / 9} fill="#0D5EAF" />
      <path
        d={`M0 ${(40 * 2) / 9}h${(40 * 5) / 9}M${(40 * 2) / 9} 0v${(40 * 5) / 9}`}
        stroke="#fff"
        strokeWidth={40 / 9}
      />
    </Frame>
  );
}

/** The Union Jack's counterchanged saltire: the classic two-pass clip. */
function BritishFlag(props: FlagProps) {
  return (
    <Frame {...props}>
      {/* Four triangles meeting at the centre. Clipping the red saltire to
          them is what offsets it into the trailing half of each white arm,
          which is the whole point of a counterchange. */}
      <clipPath id="uk-counterchange">
        <path d="M30 20h30v20zv20H30zH0V20zV0h30z" />
      </clipPath>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
      <path
        d="M0 0l60 40M60 0L0 40"
        stroke="#C8102E"
        strokeWidth="4"
        clipPath="url(#uk-counterchange)"
      />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="8" />
    </Frame>
  );
}

/** Three equal horizontal bands — Germany, Russia. */
function Tribar({ colors, ...props }: FlagProps & { colors: [string, string, string] }) {
  return (
    <Frame {...props}>
      {colors.map((color, index) => (
        <rect
          key={color + index}
          y={(index * 40) / 3}
          width="60"
          height={40 / 3}
          fill={color}
        />
      ))}
    </Frame>
  );
}

/** Three equal vertical bands — Italy, France. */
function Tricolour({ colors, ...props }: FlagProps & { colors: [string, string, string] }) {
  return (
    <Frame {...props}>
      {colors.map((color, index) => (
        <rect key={color + index} x={index * 20} width="20" height="40" fill={color} />
      ))}
    </Frame>
  );
}

/** Spain's 1:2:1 bands. The coat of arms is left off at 24 pixels wide. */
function SpanishFlag(props: FlagProps) {
  return (
    <Frame {...props}>
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
    </Frame>
  );
}

export const flags: Record<Locale, (props: FlagProps) => React.ReactElement> = {
  el: GreekFlag,
  en: BritishFlag,
  de: (props) => <Tribar colors={["#000000", "#DD0000", "#FFCE00"]} {...props} />,
  ru: (props) => <Tribar colors={["#FFFFFF", "#0039A6", "#D52B1E"]} {...props} />,
  it: (props) => <Tricolour colors={["#008C45", "#F4F5F0", "#CD212A"]} {...props} />,
  fr: (props) => <Tricolour colors={["#002395", "#FFFFFF", "#ED2939"]} {...props} />,
  es: SpanishFlag,
};
