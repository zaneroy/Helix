import { getInvestorPortalReadModel } from "@/lib/actions/investor-portal";
import { InvestorPortalShell } from "@/components/investor/InvestorPortalShell";
import { InvestorProfileView } from "@/components/investor/InvestorPortalViews";

export default async function InvestorProfilePage() {
  const model = await getInvestorPortalReadModel();

  return (
    <InvestorPortalShell active="profile" model={model}>
      <InvestorProfileView model={model} />
    </InvestorPortalShell>
  );
}