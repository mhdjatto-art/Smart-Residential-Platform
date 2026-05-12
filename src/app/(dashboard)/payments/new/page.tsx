import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PaymentForm } from "@/components/payments/payment-form";
import { requireRole } from "@/lib/auth/guards";
import { getContract, listContractsPaged, listSchedule } from "@/lib/api/contracts";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string }>;
}) {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const sp = await searchParams;

  // If no contract specified, show a contract picker.
  if (!sp.contract) {
    const { data } = await listContractsPaged({ status: "active", pageSize: 200 });
    if (data.length === 0) redirect("/contracts/new");
    return (
      <div>
        <PageHeader title="Record payment" description="Select the contract to record the payment against." />
        <ContractPicker contracts={data.map((c) => ({ id: c.id, label: c.contract_number }))} />
      </div>
    );
  }

  const contract = await getContract(sp.contract);
  if (!contract) notFound();

  const schedule = await listSchedule(sp.contract);
  const outstanding = schedule.reduce(
    (sum, s) => sum + (Number(s.total_due) + Number(s.penalty_amount) - Number(s.paid_amount)),
    0,
  );
  const nextDue = schedule.find((s) => s.status !== "paid" && s.status !== "cancelled");
  const nextDueAmount = nextDue
    ? Number(nextDue.total_due) + Number(nextDue.penalty_amount) - Number(nextDue.paid_amount)
    : null;

  return (
    <div>
      <PageHeader
        title={`Record payment · ${contract.contract_number}`}
        description="Funds are allocated FIFO across overdue → upcoming installments."
      />
      <PaymentForm contractId={contract.id} outstandingTotal={outstanding} nextDueAmount={nextDueAmount} />
    </div>
  );
}

function ContractPicker({ contracts }: { contracts: Array<{ id: string; label: string }> }) {
  return (
    <Card>
      <CardContent className="p-6">
        <form method="get" action="/payments/new" className="space-y-4">
          <div className="space-y-2">
            <Label>Contract</Label>
            <Select name="contract" required>
              <SelectTrigger><SelectValue placeholder="Choose contract" /></SelectTrigger>
              <SelectContent>
                {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Continue
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
