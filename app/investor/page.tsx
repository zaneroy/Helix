import { getInvestorPortalReadModel } from "@/lib/actions/investor-portal";
import { InvestorPortalShell } from "@/components/investor/InvestorPortalShell";
import { InvestorDashboardView } from "@/components/investor/InvestorPortalViews";

export default async function InvestorDashboardPage() {
  const model = await getInvestorPortalReadModel();

  return (
    <InvestorPortalShell active="dashboard" model={model}>
      <InvestorDashboardView model={model} />
    </InvestorPortalShell>
  );
}