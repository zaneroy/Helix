import { getEmployeePortalReadModel } from "@/lib/actions/employee-portal";
import EmployeePortalShell from "@/components/employee/EmployeePortalShell";
import { EmployeeExpensesView } from "@/components/employee/EmployeePortalViews";

export default async function EmployeeExpensesPage() {
  const model = await getEmployeePortalReadModel();

  return (
    <EmployeePortalShell model={model}>
      <EmployeeExpensesView model={model} />
    </EmployeePortalShell>
  );
}
