import { handlePaymentResponse } from "@/lib/paycenter/callback";

// The Success URL registered with Euronet against our PosId (§3).
// The outcome is still decided from the body, not from this URL — see
// `handlePaymentResponse`.

export const dynamic = "force-dynamic";

const handle = (request: Request) => handlePaymentResponse(request, "success");

export const POST = handle;
export const GET = handle;
