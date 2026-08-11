import { getEmployeePortalReadModel } from "@/lib/actions/employee-portal";
import EmployeePortalShell from "@/components/employee/EmployeePortalShell";
import { EmployeeDashboardView } from "@/components/employee/EmployeePortalViews";

export default async function EmployeeDashboardPage() {
  const model = await getEmployeePortalReadModel();

  return (
    <EmployeePortalShell model={model}>
      <EmployeeDashboardView model={model} />
    </EmployeePortalShell>
  );
}
