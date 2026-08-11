import { getInvestorPortalReadModel } from "@/lib/actions/investor-portal";
import { InvestorPortalShell } from "@/components/investor/InvestorPortalShell";
import { InvestorDocumentsView } from "@/components/investor/InvestorPortalViews";

export default async function InvestorDocumentsPage() {
  const model = await getInvestorPortalReadModel();

  return (
    <InvestorPortalShell active="documents" model={model}>
      <InvestorDocumentsView model={model} />
    </InvestorPortalShell>
  );
}