import { getInvestorPortalReadModel } from "@/lib/actions/investor-portal";
import { InvestorPortalShell } from "@/components/investor/InvestorPortalShell";
import { InvestorInvestmentsView } from "@/components/investor/InvestorPortalViews";

export default async function InvestorInvestmentsPage() {
  const model = await getInvestorPortalReadModel();

  return (
    <InvestorPortalShell active="investments" model={model}>
      <InvestorInvestmentsView model={model} />
    </InvestorPortalShell>
  );
}