import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingForm } from "@/components/bookings/booking-form";
import { requireUser } from "@/lib/auth/guards";
import { listFacilities } from "@/lib/api/facilities";
import { listResidentOptions } from "@/lib/api/residents";

export const metadata: Metadata = { title: "New booking" };
export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  await requireUser();
  const [facilities, residents] = await Promise.all([
    listFacilities(),
    listResidentOptions(),
  ]);

  if (facilities.length === 0) {
    return (
      <div>
        <PageHeader title="New booking" description="Reserve a facility." />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No facilities yet — create one first.</p>
            <Button asChild className="mt-4"><Link href="/facilities/new">Add facility</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New booking"
        description="Reserve a facility for a resident. Conflicts are auto-detected."
      />
      <BookingForm facilities={facilities} residents={residents} />
    </div>
  );
}
