export type JsonRecord = Record<string, unknown>;

export type UUID = string;

export type EmployeePortalActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type EmployeePortalNotification = {
  id: UUID;
  title: string;
  message: string;
  type: string;
  createdAt: string | null;
  readAt: string | null;
  metadata?: JsonRecord | null;
  actionUrl: string | null;
};

export type EmployeePortalActivity = {
  id: UUID;
  title: string;
  description: string;
  type: string;
  createdAt: string | null;
};

export type EmployeePortalTask = {
  id: UUID;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  priority: string;
  dueAt: string | null;
  assignedTo: UUID | null;
  createdAt: string | null;
};

export type EmployeePortalSale = {
  id: UUID;
  customerName: string | null;
  productName: string | null;
  sku: string | null;
  amount: number;
  expenseDate?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  profit: number;
  notes: string | null;
  status: string;
  createdAt: string | null;
  createdBy: UUID | null;
};

export type EmployeePortalExpense = {
  id: UUID;
  title: string;
  category: string | null;
  payee: string | null;
  notes: string | null;
  receiptUrl: string | null;
  amount: number;
  status: string;
  submittedAt: string | null;
  submittedBy: UUID | null;
};

export type EmployeePortalInventoryItem = {
  id: UUID;
  name: string;
  sku: string | null;
  stock: number;
  quantityBought: number;
  quantitySold: number;
  unitCost: number;
  sellingPrice: number;
  lowStockThreshold: number;
  status: string;
  updatedAt: string | null;
};

export type EmployeePortalSummary = {
  companyId: UUID;
  companyName: string;
  currency: string;

  employeeId: UUID;
  employeeName: string;
  employeeEmail: string | null;
  employeeInitials: string;
  role: string;
  department: string | null;

  openTaskCount: number;
  overdueTaskCount: number;
  completedTaskCount: number;

  recentSalesCount: number;
  recentSalesValue: number;

  pendingExpenseCount: number;
  pendingExpenseValue: number;

  lowStockCount: number;
  inventoryItemCount: number;

  unreadNotificationCount: number;
};

export type EmployeePortalReadModel = {
  summary: EmployeePortalSummary;
  tasks: EmployeePortalTask[];
  sales: EmployeePortalSale[];
  expenses: EmployeePortalExpense[];
  inventory: EmployeePortalInventoryItem[];
  notifications: EmployeePortalNotification[];
  activity: EmployeePortalActivity[];
};

export type SubmitEmployeePortalExpenseInput = {
  title: string;
  category: string;
  amount: number;
  expenseDate?: string;
  payee?: string;
  notes?: string;
};

export type EmployeePortalTaskStatus = "todo" | "in_progress" | "completed";

export type UpdateEmployeePortalTaskStatusInput = {
  taskId: string;
  status: EmployeePortalTaskStatus;
};
