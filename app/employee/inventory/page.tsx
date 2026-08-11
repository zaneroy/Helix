import { getEmployeePortalReadModel } from "@/lib/actions/employee-portal";
import EmployeePortalShell from "@/components/employee/EmployeePortalShell";
import { EmployeeInventoryView } from "@/components/employee/EmployeePortalViews";

export default async function EmployeeInventoryPage() {
  const model = await getEmployeePortalReadModel();

  return (
    <EmployeePortalShell model={model}>
      <EmployeeInventoryView model={model} />
    </EmployeePortalShell>
  );
}
