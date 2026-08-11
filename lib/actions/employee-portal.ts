"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emitEvent } from "@/lib/events/emitEvent";
import { createClient } from "@/lib/supabase/server";
import type {
  EmployeePortalActionResult,
  EmployeePortalActivity,
  EmployeePortalInventoryItem,
  EmployeePortalNotification,
  EmployeePortalReadModel,
  EmployeePortalSale,
  EmployeePortalTask,
  EmployeePortalExpense,
  SubmitEmployeePortalExpenseInput,
  UpdateEmployeePortalTaskStatusInput,
} from "@/types/employee-portal";

type JsonRecord = Record<string, any>;

function text(value: unknown, fallback = ""): string {
  const clean = String(value ?? "").trim();

  return clean || fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function initials(name: string, email?: string | null): string {
  const source = text(name) || text(email) || "Employee";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function rowDate(row: JsonRecord, fields: string[]): string | null {
  for (const field of fields) {
    const value = text(row[field]);

    if (value) return value;
  }

  return null;
}

function isEmployeeOwned(row: JsonRecord, userId: string): boolean {
  const owner = [
    row.employee_id,
    row.assigned_to,
    row.assignee_id,
    row.user_id,
    row.profile_id,
    row.created_by,
    row.submitted_by,
    row.owner_id,
  ]
    .map((value) => text(value))
    .find(Boolean);

  return !owner || owner === userId;
}

function isOpenStatus(value: unknown): boolean {
  const status = text(value).toLowerCase();

  return !["done", "completed", "approved", "rejected", "cancelled", "archived"].includes(status);
}

function isCompletedStatus(value: unknown): boolean {
  const status = text(value).toLowerCase();

  return ["done", "completed", "approved", "paid"].includes(status);
}

function isPendingStatus(value: unknown): boolean {
  const status = text(value).toLowerCase();

  return ["pending", "submitted", "review", "in_review", "awaiting_approval"].includes(status);
}

function isOverdue(value: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

function rowOwnerId(row: JsonRecord): string {
  return (
    text(row.employee_id) ||
    text(row.assigned_to) ||
    text(row.assignee_id) ||
    text(row.user_id) ||
    text(row.profile_id) ||
    text(row.created_by) ||
    text(row.submitted_by) ||
    text(row.actor_id) ||
    text(row.owner_id)
  );
}

function containsInvestorLanguage(row: JsonRecord): boolean {
  const haystack = [
    row.type,
    row.action,
    row.action_type,
    row.title,
    row.message,
    row.description,
    row.metadata,
    row.action_url,
  ]
    .map((value) => {
      if (typeof value === "object" && value) {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }

      return String(value ?? "");
    })
    .join(" ")
    .toLowerCase();

  const blockedTerms = [
    "investor",
    "capital",
    "equity",
    "share",
    "shares",
    "certificate",
    "agreement pdf",
    "offer pdf",
    "founder",
    "valuation",
    "ownership",
    "cap table",
    "subscription agreement",
  ];

  return blockedTerms.some((term) => haystack.includes(term));
}

function isEmployeeOperationalLanguage(row: JsonRecord): boolean {
  const haystack = [
    row.type,
    row.action,
    row.action_type,
    row.title,
    row.message,
    row.description,
    row.action_url,
  ]
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();

  const allowedTerms = [
    "employee",
    "task",
    "sale",
    "sales",
    "order",
    "inventory",
    "stock",
    "product",
    "expense",
    "receipt",
    "profile",
  ];

  return allowedTerms.some((term) => haystack.includes(term));
}

function isEmployeeSafeRow(row: JsonRecord, employeeId: string): boolean {
  if (containsInvestorLanguage(row)) return false;

  const owner = rowOwnerId(row);

  if (owner) return owner === employeeId;

  return isEmployeeOperationalLanguage(row);
}

function uniqueActivity(items: EmployeePortalActivity[]): EmployeePortalActivity[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.title}|${item.description}|${item.createdAt}`;

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
}

function buildDerivedEmployeeActivity(input: {
  tasks: EmployeePortalTask[];
  sales: EmployeePortalSale[];
  expenses: EmployeePortalExpense[];
  inventory: EmployeePortalInventoryItem[];
  currency: string;
}): EmployeePortalActivity[] {
  const saleItems: EmployeePortalActivity[] = input.sales.slice(0, 12).map((sale) => ({
    id: `sale-${sale.id}`,
    title: "Sale recorded",
    description: `${sale.productName || sale.customerName || "Sale"} · ${new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: input.currency,
      maximumFractionDigits: 2,
    }).format(numberValue(sale.amount))}`,
    type: "employee_sale",
    createdAt: sale.createdAt,
  }));

  const expenseItems: EmployeePortalActivity[] = input.expenses.slice(0, 12).map((expense) => ({
    id: `expense-${expense.id}`,
    title: "Expense submitted",
    description: `${expense.title} · ${text(expense.status, "pending")}`,
    type: "employee_expense",
    createdAt: expense.submittedAt,
  }));

  const taskItems: EmployeePortalActivity[] = input.tasks.slice(0, 12).map((task) => ({
    id: `task-${task.id}`,
    title: "Task assigned",
    description: `${task.title} · ${text(task.status, "pending")}`,
    type: "employee_task",
    createdAt: task.createdAt || task.dueAt,
  }));

  const stockItems: EmployeePortalActivity[] = input.inventory
    .filter((item) => item.stock <= item.lowStockThreshold)
    .slice(0, 12)
    .map((item) => ({
      id: `stock-${item.id}`,
      title: "Low-stock alert",
      description: `${item.name} has ${item.stock} left.`,
      type: "employee_inventory",
      createdAt: item.updatedAt,
    }));

  return uniqueActivity([...saleItems, ...expenseItems, ...taskItems, ...stockItems]).sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  );
}

async function getSessionContext() {
  const supabase = await createClient();
  const client = supabase as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/employee/login");
  }

  const { data: profile, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    redirect("/employee/login");
  }

  const profileRow = profile as JsonRecord;
  const companyId = text(profileRow.company_id);

  if (!companyId) {
    redirect("/employee/login");
  }

  return {
    supabase,
    client,
    user,
    profile: profileRow,
    companyId,
  };
}

async function readCompany(client: any, companyId: string, fallbackCurrency = "GBP") {
  try {
    const { data } = await client
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    const row = (data || {}) as JsonRecord;

    return {
      companyName:
        text(row.legal_name) ||
        text(row.company_name) ||
        text(row.name) ||
        text(row.business_name) ||
        text(row.trading_name) ||
        "Company",
      currency: text(row.currency) || fallbackCurrency || "GBP",
    };
  } catch {
    return {
      companyName: "Company",
      currency: fallbackCurrency || "GBP",
    };
  }
}

async function readRows(client: any, table: string, companyId: string): Promise<JsonRecord[]> {
  try {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("company_id", companyId)
      .limit(200);

    if (error || !data) return [];

    return data as JsonRecord[];
  } catch {
    return [];
  }
}

async function readTasks(
  client: any,
  companyId: string,
  employeeId: string,
): Promise<EmployeePortalTask[]> {
  const rows = await readRows(client, "tasks", companyId);

  return rows
    .filter((row) => isEmployeeOwned(row, employeeId))
    .map((row) => ({
      id: text(row.id) || Math.random().toString(36).slice(2),
      title: text(row.title) || text(row.name) || "Task",
      description: text(row.description) || text(row.notes) || null,
      status: text(row.status) || "pending",
      dueDate: rowDate(row, [
        "due_date",
        "dueDate",
        "deadline",
        "due_at",
        "target_date",
        "date",
      ]),
      priority: text(row.priority) || "normal",
      dueAt: rowDate(row, ["due_at", "due_date", "deadline"]),
      assignedTo:
        text(row.assigned_to) ||
        text(row.assignee_id) ||
        text(row.employee_id) ||
        null,
      createdAt: rowDate(row, ["created_at", "date"]),
    }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function readSales(
  client: any,
  companyId: string,
  employeeId: string,
): Promise<EmployeePortalSale[]> {
  const rows = await readRows(client, "sales", companyId);

  return rows
    .filter((row) => isEmployeeOwned(row, employeeId))
    .map((row) => {
      const quantity =
        numberValue(row.quantity) ||
        numberValue(row.quantity_sold) ||
        1;
      const unitPrice =
        numberValue(row.sale_price) ||
        numberValue(row.sale_price_per_piece) ||
        numberValue(row.selling_price) ||
        numberValue(row.unit_price) ||
        numberValue(row.price);
      const unitCost =
        numberValue(row.unit_cost) ||
        numberValue(row.price_per_piece) ||
        numberValue(row.cost_price) ||
        0;
      const amount =
        numberValue(row.total_amount) ||
        numberValue(row.total_sale_amount) ||
        numberValue(row.total) ||
        numberValue(row.amount) ||
        unitPrice * Math.max(quantity, 1);
      const profit =
        numberValue(row.profit_amount) ||
        numberValue(row.profit) ||
        amount - unitCost * Math.max(quantity, 1);

      return {
        id: text(row.id) || Math.random().toString(36).slice(2),
        customerName:
          text(row.customer_name) ||
          text(row.customer) ||
          text(row.buyer_name) ||
          null,
        productName:
          text(row.product_name) ||
          text(row.item_name) ||
          text(row.description) ||
          null,
        sku: text(row.sku) || text(row.product_sku) || null,
        amount,
        quantity,
        unitPrice,
        unitCost,
        profit,
        notes: text(row.notes) || null,
        status: text(row.status) || "completed",
        createdAt: rowDate(row, ["sold_at", "sale_date", "created_at", "date"]),
        createdBy:
          text(row.created_by) ||
          text(row.employee_id) ||
          text(row.user_id) ||
          null,
      };
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function readExpenses(
  client: any,
  companyId: string,
  employeeId: string,
): Promise<EmployeePortalExpense[]> {
  const rows = await readRows(client, "expenses", companyId);

  return rows
    .filter((row) => isEmployeeOwned(row, employeeId))
    .map((row) => ({
      id: text(row.id) || Math.random().toString(36).slice(2),
      title:
        text(row.title) ||
        text(row.description) ||
        text(row.vendor) ||
        "Expense",
      category: text(row.category) || text(row.expense_category) || null,
      payee:
        text(row.payee) ||
        text(row.supplier) ||
        text(row.vendor) ||
        text(row.merchant) ||
        null,
      notes:
        text(row.notes) ||
        text(row.memo) ||
        text(row.details) ||
        null,
      receiptUrl:
        text(row.receipt_url) ||
        text(row.receiptUrl) ||
        text(row.attachment_url) ||
        null,
      amount: numberValue(row.amount) || numberValue(row.total),
      status: text(row.status) || "pending",
      submittedAt: rowDate(row, ["submitted_at", "expense_date", "created_at", "date"]),
      submittedBy:
        text(row.submitted_by) ||
        text(row.employee_id) ||
        text(row.created_by) ||
        null,
    }))
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
}

async function readInventory(
  client: any,
  companyId: string,
): Promise<EmployeePortalInventoryItem[]> {
  const rows = await readRows(client, "products", companyId);

  return rows
    .map((row) => {
      const stock =
        numberValue(row.quantity_on_hand) ||
        numberValue(row.stock_quantity) ||
        numberValue(row.stock) ||
        numberValue(row.inventory_quantity) ||
        0;
      const threshold =
        numberValue(row.low_stock_limit) ||
        numberValue(row.low_stock_threshold) ||
        numberValue(row.reorder_level) ||
        numberValue(row.minimum_stock) ||
        5;

      return {
        id: text(row.id) || Math.random().toString(36).slice(2),
        name:
          text(row.item_name) ||
          text(row.name) ||
          text(row.product_name) ||
          "Product",
        sku: text(row.sku) || text(row.code) || null,
        stock,
        quantityBought: numberValue(row.quantity_bought),
        quantitySold: numberValue(row.quantity_sold),
        unitCost:
          numberValue(row.price_per_piece) ||
          numberValue(row.cost_price) ||
          numberValue(row.cost) ||
          0,
        sellingPrice:
          numberValue(row.selling_price) ||
          numberValue(row.sale_price) ||
          numberValue(row.retail_price) ||
          0,
        lowStockThreshold: threshold,
        status: stock <= threshold ? "low_stock" : text(row.status) || "active",
        updatedAt: rowDate(row, ["updated_at", "created_at", "delivery_date"]),
      };
    })
    .sort((a, b) => a.stock - b.stock);
}


function notificationMetadataValue(row: JsonRecord, keys: string[]): string {
  const metadata = row.metadata && typeof row.metadata === "object"
    ? (row.metadata as JsonRecord)
    : {};

  for (const key of keys) {
    const directValue = text(row[key]);
    const metadataValue = text(metadata[key]);

    if (directValue) return directValue;
    if (metadataValue) return metadataValue;
  }

  return "";
}

function employeeNotificationIsAllowed(row: JsonRecord, userId: string): boolean {
  const type = text(row.type).toLowerCase();
  const title = text(row.title).toLowerCase();
  const message = text(row.message).toLowerCase();
  const actionUrl = (text(row.action_url) || text(row.actionUrl)).toLowerCase();
  const haystack = `${type} ${title} ${message} ${actionUrl}`;

  const blocked = [
    "investor",
    "capital",
    "equity",
    "share",
    "certificate",
    "agreement pdf",
    "offer pdf",
    "dividend",
    "buyback",
    "valuation",
  ];

  if (blocked.some((word) => haystack.includes(word))) return false;

  const explicitUserId = notificationMetadataValue(row, [
    "user_id",
    "userId",
    "recipient_id",
    "recipientId",
    "employee_id",
    "employeeId",
    "assigned_to",
    "assignedTo",
    "submitted_by",
    "submittedBy",
    "created_by",
    "createdBy",
    "updatedBy",
    "updated_by",
  ]);

  if (explicitUserId) return explicitUserId === userId;

  if (actionUrl.startsWith("/employee")) return true;
  if (type.startsWith("employee_")) return true;

  return [
    "task",
    "expense",
    "sale",
    "inventory",
    "stock",
    "low_stock",
    "low-stock",
  ].some((word) => haystack.includes(word));
}

function mapEmployeeNotificationRow(row: JsonRecord): EmployeePortalNotification {
  return {
    id: text(row.id),
    type: text(row.type) || "employee_update",
    title: text(row.title) || "Employee update",
    message: text(row.message) || "",
    actionUrl: text(row.action_url) || text(row.actionUrl) || "/employee",
    readAt: text(row.read_at) || text(row.readAt) || null,
    createdAt: text(row.created_at) || text(row.createdAt) || new Date().toISOString(),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as JsonRecord)
        : {},
  };
}


async function readNotifications(
  clientArg?: any,
  companyIdArg?: string,
  userIdArg?: string,
): Promise<EmployeePortalNotification[]> {
  try {
    let client = clientArg;
    let companyId = companyIdArg;
    let userId = userIdArg;

    if (!client || !companyId || !userId) {
      const context = await getSessionContext();
      client = context.client;
      companyId = context.companyId;
      userId = context.user.id;
    }

    const { data, error } = await client
      .from("notifications")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) return [];

    return ((data || []) as JsonRecord[])
      .filter((row) => employeeNotificationIsAllowed(row, String(userId)))
      .map(mapEmployeeNotificationRow)
      .filter((notification) => notification.id)
      .slice(0, 20);
  } catch {
    return [];
  }
}

async function readActivity(
  client: any,
  companyId: string,
  employeeId: string,
): Promise<EmployeePortalActivity[]> {
  const tables = ["employee_activity", "activity_logs", "activities"];

  for (const table of tables) {
    try {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("company_id", companyId)
        .limit(80);

      if (error || !data) continue;

      return (data as JsonRecord[])
        .filter((row) => isEmployeeSafeRow(row, employeeId))
        .map((row) => ({
          id: text(row.id) || Math.random().toString(36).slice(2),
          title: text(row.title) || text(row.action) || "Activity",
          description: text(row.description) || text(row.message) || "",
          type: text(row.type) || text(row.action_type) || "activity",
          createdAt: rowDate(row, ["created_at", "date"]),
        }))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    } catch {
      // try next table
    }
  }

  return [];
}

export async function getEmployeePortalReadModel(): Promise<EmployeePortalReadModel> {
  const { client, user, profile, companyId } = await getSessionContext();
  const company = await readCompany(client, companyId, text(profile.currency) || "GBP");
  const employeeName =
    text(profile.full_name) ||
    text(profile.name) ||
    text(user.email) ||
    "Employee";
  const employeeEmail = text(profile.email) || text(user.email) || null;
  const employeeId = text(user.id);
  const role =
    text(profile.job_title) ||
    text(profile.role) ||
    text(profile.employee_role) ||
    "Employee";
  const department = text(profile.department) || null;

  const [tasks, sales, expenses, inventory, notifications, storedActivity] =
    await Promise.all([
      readTasks(client, companyId, employeeId),
      readSales(client, companyId, employeeId),
      readExpenses(client, companyId, employeeId),
      readInventory(client, companyId),
      readNotifications(client, employeeId),
      readActivity(client, companyId, employeeId),
    ]);

  const derivedActivity = buildDerivedEmployeeActivity({
    tasks,
    sales,
    expenses,
    inventory,
    currency: company.currency,
  });
  const activity = uniqueActivity([...storedActivity, ...derivedActivity])
    .filter((item) => !containsInvestorLanguage(item as unknown as JsonRecord))
    .slice(0, 30);

  const openTasks = tasks.filter((task) => isOpenStatus(task.status));
  const completedTasks = tasks.filter((task) => isCompletedStatus(task.status));
  const pendingExpenses = expenses.filter((expense) => isPendingStatus(expense.status));
  const lowStockItems = inventory.filter((item) => item.stock <= item.lowStockThreshold);

  return {
    summary: {
      companyId,
      companyName: company.companyName,
      currency: company.currency,
      employeeId,
      employeeName,
      employeeEmail,
      employeeInitials: initials(employeeName, employeeEmail),
      role,
      department,
      openTaskCount: openTasks.length,
      overdueTaskCount: openTasks.filter((task) => isOverdue(task.dueAt)).length,
      completedTaskCount: completedTasks.length,
      recentSalesCount: sales.length,
      recentSalesValue: sales.reduce((sum, sale) => sum + sale.amount, 0),
      pendingExpenseCount: pendingExpenses.length,
      pendingExpenseValue: pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      lowStockCount: lowStockItems.length,
      inventoryItemCount: inventory.length,
      unreadNotificationCount: notifications.filter((notice) => !notice.readAt).length,
    },
    tasks,
    sales,
    expenses,
    inventory,
    notifications,
    activity,
  };
}



async function getOrCreateEmployeeSalesCashAccount(input: {
  client: any;
  companyId: string;
  userId: string;
  currency: string;
}): Promise<string | null> {
  const { client, companyId, userId, currency } = input;

  try {
    const { data: existingAccounts } = await client
      .from("cash_accounts")
      .select("id, name, account_type, status, created_at")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(20);

    const rows = ((existingAccounts || []) as JsonRecord[]).filter(Boolean);
    const preferred =
      rows.find((row) => {
        const name = `${row.name || ""} ${row.account_type || ""}`.toLowerCase();

        return (
          name.includes("bank") ||
          name.includes("cash") ||
          name.includes("sales") ||
          name.includes("business")
        );
      }) || rows[0];

    const existingId = text(preferred?.id);

    if (existingId) return existingId;

    const { data: createdAccount, error: createError } = await client
      .from("cash_accounts")
      .insert({
        company_id: companyId,
        name: "Employee Sales Cash",
        account_type: "cash",
        currency: currency || "GBP",
        opening_balance: 0,
        status: "active",
        notes: "Automatically created for employee sale cash receipts.",
        created_by: userId,
      })
      .select("id")
      .maybeSingle();

    if (createError) return null;

    return text((createdAccount as JsonRecord | null)?.id) || null;
  } catch {
    return null;
  }
}

async function recordEmployeeSaleCashLedger(input: {
  client: any;
  companyId: string;
  userId: string;
  saleId: string | null;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
  now: string;
}): Promise<void> {
  const accountId = await getOrCreateEmployeeSalesCashAccount({
    client: input.client,
    companyId: input.companyId,
    userId: input.userId,
    currency: input.currency,
  });

  const { error } = await input.client.from("cash_ledger").insert({
    company_id: input.companyId,
    source_type: "employee_sale",
    source_id: input.saleId,
    direction: "inflow",
    amount: input.amount,
    category: "Sales",
    description: `Employee sale: ${input.productName}`,
    transaction_date: input.now,
    created_by: input.userId,
    account_id: accountId,
    reference: input.saleId ? `SALE-${input.saleId}` : null,
    status: "completed",
    reconciled: false,
    metadata: {
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount: input.amount,
      employeeId: input.userId,
      channel: "employee_portal",
    },
  });

  if (error) {
    throw new Error(text(error.message) || "Sale recorded, but cash ledger could not be updated.");
  }
}

export async function recordEmployeePortalSale(input: {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}): Promise<EmployeePortalActionResult<{ saleId: string | null }>> {
  try {
    const { client } = await getSessionContext();
    const productId = text(input.productId);
    const quantity = Math.floor(numberValue(input.quantity));
    const unitPrice = numberValue(input.unitPrice);

    if (!productId) {
      return { ok: false, error: "Select a product before recording the sale." };
    }

    if (quantity <= 0) {
      return { ok: false, error: "Enter a quantity greater than zero." };
    }

    if (unitPrice <= 0) {
      return { ok: false, error: "Enter a selling price greater than zero." };
    }

    const notes = text(input.notes);

    const { data, error } = await client.rpc("record_employee_sale_with_cash_ledger", {
      p_product_id: productId,
      p_quantity: quantity,
      p_sale_price: unitPrice,
      p_notes: notes || null,
    });

    if (error) {
      return {
        ok: false,
        error: text(error.message) || "Could not record the sale.",
      };
    }

    const result = (data || {}) as JsonRecord;

    revalidatePath("/employee");
    revalidatePath("/employee/sales");
    revalidatePath("/employee/inventory");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/activity");

    return {
      ok: true,
      data: {
        saleId: text(result.sale_id) || text(result.saleId) || null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not record the sale.",
    };
  }
}



function missingExpenseColumnFromMessage(message: string): string | null {
  const patterns = [
    /Could not find the '([^']+)' column of 'expenses'/i,
    /column "([^"]+)" of relation "expenses" does not exist/i,
    /record "new" has no field "([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) return match[1];
  }

  return null;
}

async function insertEmployeeExpenseAdaptively(
  client: any,
  initialPayload: JsonRecord,
): Promise<{ expenseId: string | null; error: string | null }> {
  let payload: JsonRecord = Object.fromEntries(
    Object.entries(initialPayload).filter(([, value]) => value !== undefined && value !== ""),
  );
  let lastError = "Could not submit the expense.";

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { data, error } = await client
      .from("expenses")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (!error) {
      return {
        expenseId: text((data as JsonRecord | null)?.id) || null,
        error: null,
      };
    }

    lastError = text(error.message) || lastError;
    const missingColumn = missingExpenseColumnFromMessage(lastError);

    if (!missingColumn || !(missingColumn in payload)) {
      return { expenseId: null, error: lastError };
    }

    const nextPayload = { ...payload };
    delete nextPayload[missingColumn];
    payload = nextPayload;
  }

  return { expenseId: null, error: lastError };
}

export async function submitEmployeePortalExpense(
  input: SubmitEmployeePortalExpenseInput,
): Promise<EmployeePortalActionResult<{ expenseId: string | null }>> {
  try {
    const { client, user, companyId } = await getSessionContext();
    const title = text(input.title);
    const category = text(input.category) || "General";
    const amount = numberValue(input.amount);
    const payee = text(input.payee);
    const notes = text(input.notes);
    const now = new Date().toISOString();
    const selectedExpenseDate = text(input.expenseDate);
    const expenseTimestamp = selectedExpenseDate
      ? new Date(`${selectedExpenseDate}T12:00:00`).toISOString()
      : now;

    if (!title) {
      return { ok: false, error: "Enter an expense title." };
    }

    if (amount <= 0) {
      return { ok: false, error: "Enter an amount greater than zero." };
    }

    const description = notes ? `${title} - ${notes}` : title;

    const insertResult = await insertEmployeeExpenseAdaptively(client, {
      company_id: companyId,
      title,
      description,
      category,
      expense_category: category,
      amount,
      total: amount,
      payee,
      supplier: payee,
      vendor: payee,
      merchant: payee,
      notes,
      memo: notes,
      details: notes,
      status: "pending",
      submitted_by: user.id,
      employee_id: user.id,
      created_by: user.id,
      user_id: user.id,
      submitted_at: expenseTimestamp,
      expense_date: selectedExpenseDate || expenseTimestamp,
      created_at: now,
    });

    if (insertResult.error) {
      return { ok: false, error: insertResult.error };
    }

    await emitEmployeePortalEvent({
      type: "employee_expense_submitted",
      title: "Expense submitted",
      message: `${title} expense was submitted for review.`,
      actionUrl: "/employee/expenses",
      metadata: {
        expenseId: insertResult.expenseId,
        title,
        category,
        amount,
        payee,
        notes,
        expenseDate: selectedExpenseDate || expenseTimestamp,
      },
    });

    revalidatePath("/employee");
    revalidatePath("/employee/expenses");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/activity");

    return { ok: true, data: { expenseId: insertResult.expenseId } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not submit the expense.",
    };
  }
}


export async function updateEmployeePortalTaskStatus(
  input: UpdateEmployeePortalTaskStatusInput,
): Promise<EmployeePortalActionResult<{ taskId: string }>> {
  try {
    const { client, user, companyId } = await getSessionContext();
    const taskId = text(input.taskId);
    const status = text(input.status);

    if (!taskId) {
      return { ok: false, error: "Missing task id." };
    }

    if (!["todo", "in_progress", "completed"].includes(status)) {
      return { ok: false, error: "Invalid task status." };
    }

    const now = new Date().toISOString();

    const candidateUpdates: JsonRecord[] = [
      {
        status,
        updated_at: now,
        completed_at: status === "completed" ? now : null,
      },
      {
        status,
        completed_at: status === "completed" ? now : null,
      },
      {
        status,
      },
    ];

    let lastError = "Could not update the task.";

    for (const patch of candidateUpdates) {
      const { error } = await client
        .from("tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("company_id", companyId);

      if (!error) {
        await emitEmployeePortalEvent({
          type: "employee_task_updated",
          title: "Task updated",
          message: `Task status changed to ${status.replace("_", " ")}.`,
          actionUrl: "/employee/tasks",
          metadata: {
            taskId,
            status,
            updatedBy: user.id,
          },
        });

        revalidatePath("/employee");
        revalidatePath("/employee/tasks");
        revalidatePath("/dashboard/tasks");
        revalidatePath("/dashboard/activity");

        return { ok: true, data: { taskId } };
      }

      lastError = text(error.message) || lastError;

      if (
        !/Could not find the 'updated_at' column/i.test(lastError) &&
        !/Could not find the 'completed_at' column/i.test(lastError) &&
        !/column "updated_at" of relation "tasks" does not exist/i.test(lastError) &&
        !/column "completed_at" of relation "tasks" does not exist/i.test(lastError)
      ) {
        break;
      }
    }

    return { ok: false, error: lastError };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update the task.",
    };
  }
}



export async function markAllEmployeeNotificationsReadInline(): Promise<EmployeePortalActionResult<{ updated: boolean }>> {
  try {
    const { client, user, companyId } = await getSessionContext();
    const now = new Date().toISOString();

    const candidateFilters = [
      { column: "user_id", value: user.id },
      { column: "recipient_id", value: user.id },
      { column: "employee_id", value: user.id },
    ];

    for (const filter of candidateFilters) {
      const { error } = await client
        .from("notifications")
        .update({ read_at: now })
        .eq("company_id", companyId)
        .eq(filter.column, filter.value);

      if (!error) {
        revalidatePath("/employee");
        revalidatePath("/employee/sales");
        revalidatePath("/employee/inventory");
        revalidatePath("/employee/expenses");
        revalidatePath("/employee/tasks");
        revalidatePath("/employee/profile");

        return { ok: true, data: { updated: true } };
      }
    }

    return { ok: true, data: { updated: false } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not mark notifications as read.",
    };
  }
}




export async function updateEmployeePortalPhoneNumber(input: { phone: string }): Promise<EmployeePortalActionResult<{ phone: string }>> {
  try {
    const { client, user } = await getSessionContext();

    const phone = text(input.phone).replace(/\s+/g, " ").trim();

    if (phone.length > 40) {
      return {
        ok: false,
        error: "Phone number is too long.",
      };
    }

    const attempts = [
      { table: "profiles", matchColumn: "id", matchValue: user.id, column: "phone" },
      { table: "profiles", matchColumn: "id", matchValue: user.id, column: "phone_number" },
      { table: "employees", matchColumn: "user_id", matchValue: user.id, column: "phone" },
      { table: "employees", matchColumn: "user_id", matchValue: user.id, column: "phone_number" },
      { table: "employee_profiles", matchColumn: "user_id", matchValue: user.id, column: "phone" },
      { table: "employee_profiles", matchColumn: "user_id", matchValue: user.id, column: "phone_number" },
    ];

    let lastError = "";

    for (const attempt of attempts) {
      const { error } = await client
        .from(attempt.table)
        .update({ [attempt.column]: phone || null })
        .eq(attempt.matchColumn, attempt.matchValue);

      if (!error) {
        revalidatePath("/employee");
        revalidatePath("/employee/profile");

        return {
          ok: true,
          data: { phone },
        };
      }

      lastError = error.message;
    }

    return {
      ok: false,
      error:
        lastError ||
        "Could not save the phone number. Add a phone or phone_number column to the employee profile table.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not save the phone number.",
    };
  }
}


export async function sendEmployeePortalPasswordResetEmail(): Promise<EmployeePortalActionResult<{ email: string }>> {
  try {
    const { client, user } = await getSessionContext();
    const email = text(user.email);

    if (!email) {
      return { ok: false, error: "No email address is attached to this employee account." };
    }

    const siteUrl =
      text(process.env.NEXT_PUBLIC_SITE_URL) ||
      text(process.env.NEXT_PUBLIC_APP_URL) ||
      text(process.env.NEXT_PUBLIC_VERCEL_URL);

    const normalizedSiteUrl = siteUrl
      ? siteUrl.startsWith("http")
        ? siteUrl.replace(/\/$/, "")
        : `https://${siteUrl.replace(/\/$/, "")}`
      : "";

    const { error } = await client.auth.resetPasswordForEmail(
      email,
      normalizedSiteUrl ? { redirectTo: `${normalizedSiteUrl}/reset-password` } : undefined,
    );

    if (error) return { ok: false, error: error.message };

    return { ok: true, data: { email } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send the password reset email.",
    };
  }
}


export async function markEmployeeNotificationReadInline(notificationId: string): Promise<void> {
  try {
    const { client, user } = await getSessionContext();

    await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .or(`recipient_id.eq.${user.id},user_id.eq.${user.id},profile_id.eq.${user.id}`);
  } catch {
    // Notification read state should not break the portal.
  }

  revalidatePath("/employee");
}

export async function signOutEmployee(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/employee/login");
}

export async function emitEmployeePortalEvent(input: {
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: JsonRecord;
}): Promise<void> {
  try {
    const { user, companyId } = await getSessionContext();

    await emitEvent({
      companyId,
      actorId: user.id,
      recipients: [user.id],
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl || "/employee",
      metadata: input.metadata || {},
    });
  } catch {
    // Events should not block employee flows.
  }
}
