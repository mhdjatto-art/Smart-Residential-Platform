import { redirect } from "next/navigation";

// OTP flow has been replaced by email + password. This route exists only to
// catch any stale bookmarks and bounce them to /login.
export const dynamic = "force-dynamic";

export default function VerifyOtpPage() {
  redirect("/login");
}
