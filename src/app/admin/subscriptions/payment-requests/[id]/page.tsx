import Link from "next/link";
import { getAdminUser } from "@/lib/auth/admin";
import { AdminPaymentReview } from "@/components/subscriptions/admin-payment-review";

export default async function PaymentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  const { id } = await params;
  if (!user) {
    return <main className="min-h-screen bg-[#05090f] p-6 text-white grid place-items-center"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><h1 className="text-2xl font-semibold">Administrator sign-in required</h1><p className="mt-3 text-sm text-white/60">This email link cannot approve a payment. Sign in to Scholar with an authorized administrator account, then reopen the link.</p><Link href="/" className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 font-semibold text-black">Open Scholar sign-in</Link></section></main>;
  }
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#12354b_0,#05090f_48%)]"><AdminPaymentReview requestId={id} /></div>;
}
