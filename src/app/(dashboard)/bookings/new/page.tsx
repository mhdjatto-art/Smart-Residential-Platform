import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingForm } from "@/components/bookings/booking-form";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { listFacilities } from "@/lib/api/facilities";
import { listResidentOptions } from "@/lib/api/residents";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New booking" };
export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  await requireCapability("facility:read");
  await requireUser();
  const [facilities, residents] = await Promise.all([
    listFacilities(),
    listResidentOptions(),
  ]);
  const { t } = await getT();

  if (facilities.length === 0) {
    return (
      <div>
        <PageHeader title={t("ops.new_booking_title")} description={t("ops.new_booking_desc")} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("ops.new_booking_no_facilities")}</p>
            <Button asChild className="mt-4"><Link href="/facilities/new">{t("ops.facilities_add")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("ops.new_booking_title")}
        description={t("ops.new_booking_desc_full")}
      />
      <BookingForm facilities={facilities} residents={residents} />
    </div>
  );
}
