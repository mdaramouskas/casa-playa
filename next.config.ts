import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // `undici` reaches for `net`/`tls` and is only ever used on the server, in
  // `lib/paycenter/egress.ts`. Left to `require`, as the bundler has nothing
  // useful to do with it.
  serverExternalPackages: ["undici"],

  async headers() {
    return [
      {
        // Redirection §3/§5: the handoff page POSTs the customer to
        // paycenter.piraeusbank.gr, and Euronet matches the incoming Referer
        // against the Referrer URL registered for our PosId. The browser
        // default (`strict-origin-when-cross-origin`) would send only
        // `https://booking.casaplaya.gr/` and drop the path, so the registered
        // URL could never match. `no-referrer-when-downgrade` sends the full
        // URL over https→https and still sends nothing on a downgrade to http.
        source: "/:locale(en)?/pay/handoff",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
