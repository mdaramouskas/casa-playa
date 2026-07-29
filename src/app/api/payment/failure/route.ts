import { handlePaymentResponse } from "@/lib/paycenter/callback";

// The Failure URL registered with Euronet against our PosId (§3). §3 asks for
// success and failure as two separate registrations, so this exists as its own
// URL rather than pointing at the success one.

export const dynamic = "force-dynamic";

const handle = (request: Request) => handlePaymentResponse(request, "failure");

export const POST = handle;
export const GET = handle;
