import { getInvestorPortalReadModel } from "@/lib/actions/investor-portal";
import { InvestorPortalShell } from "@/components/investor/InvestorPortalShell";
import { InvestorReportsView } from "@/components/investor/InvestorPortalViews";

export default async function InvestorReportsPage() {
  const model = await getInvestorPortalReadModel();

  return (
    <InvestorPortalShell active="reports" model={model}>
      <InvestorReportsView model={model} />
    </InvestorPortalShell>
  );
}