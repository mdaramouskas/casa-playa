// Verifies the ticketing proxy from wherever you run it.
//
//   PAYCENTER_PROXY_PASSWORD=… node infra/proxy/check.mjs
//
// Checks the four properties the proxy exists to have: it reaches the bank, it
// refuses a wrong secret, it refuses any other destination, and its identity
// rests on the pinned certificate rather than on the public roots.
//
// The certificate is read from PAYCENTER_PROXY_CA if set (PEM or base64),
// otherwise from proxy.crt next to this file.

import { readFileSync } from "node:fs";
import { fetch, ProxyAgent } from "undici";

const URI = process.env.PAYCENTER_PROXY_URL ?? "https://46.224.113.245:8443";
const USER = process.env.PAYCENTER_PROXY_USER ?? "casaplaya";
const PASSWORD = process.env.PAYCENTER_PROXY_PASSWORD;
const WSDL =
  "https://paycenter.piraeusbank.gr/services/tickets/issuer.asmx?WSDL";

if (!PASSWORD) {
  console.error("Set PAYCENTER_PROXY_PASSWORD first.");
  process.exit(2);
}

function certificate() {
  const raw = process.env.PAYCENTER_PROXY_CA;
  if (!raw) return readFileSync(new URL("./proxy.crt", import.meta.url), "utf8");
  const value = raw.trim();
  return value.startsWith("-----BEGIN")
    ? value
    : Buffer.from(value, "base64").toString("utf8");
}

const ca = certificate();
const basic = (password) =>
  `Basic ${Buffer.from(`${USER}:${password}`).toString("base64")}`;

async function check(name, expectation, { url = WSDL, ...agentOpts }) {
  const dispatcher = new ProxyAgent({
    uri: URI,
    token: basic(PASSWORD),
    proxyTls: { ca },
    ...agentOpts,
  });
  let outcome;
  try {
    const res = await fetch(url, { dispatcher });
    await res.arrayBuffer();
    outcome = { ok: res.status === 200, detail: `HTTP ${res.status}` };
  } catch (err) {
    outcome = { ok: false, detail: err.cause?.code ?? err.cause?.message ?? err.message };
  } finally {
    await dispatcher.close();
  }
  const pass = outcome.ok === expectation;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${name.padEnd(34)} ${outcome.detail}`,
  );
  return pass;
}

const results = [
  await check("reaches paycenter", true, {}),
  await check("refuses a wrong secret", false, { token: basic("wrong") }),
  await check("refuses no secret", false, { token: undefined }),
  await check("refuses another destination", false, { url: "https://example.com/" }),
  await check("is trusted only via the pin", false, { proxyTls: {} }),
];

process.exit(results.every(Boolean) ? 0 : 1);
