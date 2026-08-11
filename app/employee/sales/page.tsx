import { getEmployeePortalReadModel } from "@/lib/actions/employee-portal";
import EmployeePortalShell from "@/components/employee/EmployeePortalShell";
import { EmployeeSalesView } from "@/components/employee/EmployeePortalViews";

export type EmployeeProduct = {
  id: string;
  name: string;
  sku?: string | null;
  stock?: number;
  stock_quantity?: number;
  quantity?: number;
};

export type EmployeeSale = {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  customer_name?: string | null;
  quantity?: number;
  amount?: number;
  total_amount?: number;
  created_at?: string | null;
  sale_date?: string | null;
};

export default async function EmployeeSalesPage() {
  const model = await getEmployeePortalReadModel();

  return (
    <EmployeePortalShell model={model}>
      <EmployeeSalesView model={model} />
    </EmployeePortalShell>
  );
}
