import { getEmployeePortalReadModel } from "@/lib/actions/employee-portal";
import EmployeePortalShell from "@/components/employee/EmployeePortalShell";
import { EmployeeTasksView } from "@/components/employee/EmployeePortalViews";

export default async function EmployeeTasksPage() {
  const model = await getEmployeePortalReadModel();

  return (
    <EmployeePortalShell model={model}>
      <EmployeeTasksView model={model} />
    </EmployeePortalShell>
  );
}
