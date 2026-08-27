import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SalesClient from "./SalesClient";
import type { Sale } from "./SalesClient";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";
import { postSaleToGeneralLedger } from "@/lib/accounting/postSaleToGeneralLedger";


export type ImportedSaleRow = {
  sale_date?: string;
  reference?: string;
  customer?: string;
  sku?: string;
  quantity?: number | string;
  unit_price?: number | string;
  discount?: number | string;
  tax?: number | string;
  payment_method?: string;
  account?: string;
  notes?: string;
};

export type SalesCashAccount = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  status: string;
  balance: number;
};

type SalesCashAccountRow = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  status: string;
  opening_balance: number | string | null;
};

type SalesLedgerBalanceRow = {
  account_id: string | null;
  direction: string;
  amount: number | string | null;
  status: string | null;
};

type ProductRow = {
  id: string;
  item_name: string | null;
  name: string;
  sku: string | null;
  quantity_sold: number | string | null;
  quantity_on_hand: number | string | null;
  quantity_bought: number | string | null;
  price_per_piece: number | string | null;
  selling_price: number | string | null;
  total_cost: number | string | null;
};


function getSalesErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  return error.message || "Something went wrong. Please try again.";
}

function getProductName(product: {
  item_name?: string | null;
  name?: string | null;
  sku?: string | null;
}) {
  return product.item_name || product.name || product.sku || "Product";
}

function getDateOnly(value: string | null | undefined) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

type SaleWithRecorderDetails = Sale & {
  created_by?: string | null;
  recorded_by_name?: string | null;
  recorded_by_role?: string | null;
  notes?: string | null;
};

async function attachSaleRecorderDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sales: SaleWithRecorderDetails[]
): Promise<SaleWithRecorderDetails[]> {
  const recorderIds = Array.from(
    new Set(
      sales
        .map((sale) => sale.created_by)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (!recorderIds.length) {
    return sales.map((sale) => ({
      ...sale,
      recorded_by_name: sale.recorded_by_name || null,
      recorded_by_role: sale.recorded_by_role || null,
    }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", recorderIds);

  const profileMap = new Map(
    ((profiles || []) as Array<{
      id: string;
      full_name: string | null;
      role: string | null;
    }>).map((profile) => [profile.id, profile])
  );

  return sales.map((sale) => {
    const profile = sale.created_by ? profileMap.get(sale.created_by) : null;

    return {
      ...sale,
      recorded_by_name:
        sale.recorded_by_name ||
        profile?.full_name ||
        (sale.created_by ? "Team member" : null),
      recorded_by_role: sale.recorded_by_role || profile?.role || null,
    };
  });
}


async function getAdminProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  return { supabase, user, profile };
}

async function getSalesCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
) {
  const { data: category } = await supabase
    .from("cash_categories")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("status", "active")
    .ilike("name", "Sales")
    .limit(1)
    .maybeSingle();

  return {
    categoryId: category?.id || null,
    categoryName: category?.name || "Sales",
  };
}

async function getSelectedSalesAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  accountId: string
) {
  if (!accountId) return null;

  const { data: account } = await supabase
    .from("cash_accounts")
    .select("id, name, account_type, accounting_account_id, currency, status")
    .eq("id", accountId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  return account || null;
}

function revalidateSalesPages() {
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
}

async function recordSale(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const productId = String(formData.get("product_id") || "");
  const accountId = String(formData.get("account_id") || "").trim();
  const quantity = Number(formData.get("quantity") || 0);
  const sellingPrice = Number(formData.get("selling_price") || 0);

  if (
    !productId ||
    !accountId ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(sellingPrice) ||
    quantity <= 0 ||
    sellingPrice <= 0
  ) {
    redirect(
      "/dashboard/sales?error=Please select a product and enter valid sale details."
    );
  }

  const [selectedAccount, salesCategory] = await Promise.all([
    getSelectedSalesAccount(
      supabase,
      profile.company_id,
      accountId
    ),
    getSalesCategory(supabase, profile.company_id),
  ]);

  if (!selectedAccount) {
    redirect(
      "/dashboard/sales?error=Select a valid active financial account for this sale."
    );
  }

  if (!selectedAccount.accounting_account_id) {
  redirect(
    "/dashboard/sales?error=The selected financial account is not linked to the General Ledger."
  );
}

  const { data: product, error: productLookupError } = await supabase
    .from("products")
    .select(
      "id, item_name, name, sku, quantity_sold, quantity_on_hand, price_per_piece"
    )
    .eq("id", productId)
    .eq("company_id", profile.company_id)
    .single();

  if (productLookupError || !product) {
    redirect("/dashboard/sales?error=Product not found.");
  }

  const currentOnHand = Number(product.quantity_on_hand || 0);
  const currentSold = Number(product.quantity_sold || 0);
  const unitCost = Number(product.price_per_piece || 0);

  if (quantity > currentOnHand) {
    redirect("/dashboard/sales?error=Not enough stock available.");
  }

  const soldAt = new Date().toISOString();
  const totalAmount = sellingPrice * quantity;
  const profitAmount = (sellingPrice - unitCost) * quantity;
  const finalOnHand = currentOnHand - quantity;
  const finalSold = currentSold + quantity;
  const productName = getProductName(product);

  const { data: createdSale, error: saleError } = await supabase
    .from("sales")
    .insert({
      company_id: profile.company_id,
      product_id: productId,
      quantity,
      sale_price: sellingPrice,
      unit_cost: unitCost,
      total_amount: totalAmount,
      profit_amount: profitAmount,
      created_by: user.id,
      sold_at: soldAt,
    })
    .select("id")
    .single();

  if (saleError || !createdSale) {
    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        getSalesErrorMessage(saleError || {})
      )}`
    );
  }

  const { error: productError } = await supabase
    .from("products")
    .update({
      quantity_sold: finalSold,
      quantity_on_hand: finalOnHand,
      stock_quantity: finalOnHand,
    })
    .eq("id", productId)
    .eq("company_id", profile.company_id);

  if (productError) {
    await supabase
      .from("sales")
      .delete()
      .eq("id", createdSale.id)
      .eq("company_id", profile.company_id);

    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        productError.message
      )}`
    );
  }

  const { error: ledgerError } = await supabase
    .from("cash_ledger")
    .insert({
      company_id: profile.company_id,
      account_id: selectedAccount.id,
      category_id: salesCategory.categoryId,
      source_type: "sale",
      source_id: createdSale.id,
      direction: "inflow",
      amount: totalAmount,
      category: salesCategory.categoryName,
      description: `${quantity} × ${productName}`,
      reference: `SALE-${createdSale.id.slice(0, 8).toUpperCase()}`,
      transaction_date: getDateOnly(soldAt),
      status: "completed",
      reconciled: false,
      created_by: user.id,
      metadata: {
        saleId: createdSale.id,
        productId,
        productName,
        sku: product.sku,
        quantity,
        sellingPrice,
        unitCost,
        totalAmount,
        profitAmount,
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        accountType: selectedAccount.account_type,
        accountCurrency: selectedAccount.currency,
      },
    });

  if (ledgerError) {
    await supabase
      .from("products")
      .update({
        quantity_sold: currentSold,
        quantity_on_hand: currentOnHand,
        stock_quantity: currentOnHand,
      })
      .eq("id", productId)
      .eq("company_id", profile.company_id);

    await supabase
      .from("sales")
      .delete()
      .eq("id", createdSale.id)
      .eq("company_id", profile.company_id);

    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        `The sale was not recorded because the Accounts ledger could not be updated: ${ledgerError.message}`
      )}`
    );
  }

  try {
  await postSaleToGeneralLedger({
  supabase,
  companyId:
    profile.company_id,
  userId: user.id,
  saleId: createdSale.id,
  saleDate: soldAt,
  productName,
  quantity,
  unitCost,
  totalAmount,
  paymentAccountingAccountId:
    selectedAccount.accounting_account_id,
});
} catch (accountingError) {
  /*
   * The operational sale must not survive
   * when its accounting posting fails.
   */

  await supabase
    .from("cash_ledger")
    .delete()
    .eq(
      "company_id",
      profile.company_id
    )
    .eq("source_type", "sale")
    .eq(
      "source_id",
      createdSale.id
    );

  await supabase
    .from("products")
    .update({
      quantity_sold:
        currentSold,
      quantity_on_hand:
        currentOnHand,
      stock_quantity:
        currentOnHand,
    })
    .eq("id", productId)
    .eq(
      "company_id",
      profile.company_id
    );

  await supabase
    .from("sales")
    .delete()
    .eq(
      "id",
      createdSale.id
    )
    .eq(
      "company_id",
      profile.company_id
    );

  const message =
    accountingError instanceof Error
      ? accountingError.message
      : "Unknown accounting posting error.";

  redirect(
    `/dashboard/sales?error=${encodeURIComponent(
      `The sale was not recorded because its General Ledger posting failed: ${message}`
    )}`
  );
}

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "sale_recorded",
    title: "Sale recorded",
    message: `${quantity} × ${productName} was sold for ${totalAmount.toFixed(
      2
    )} and posted to ${selectedAccount.name}.`,
    actionUrl: "/dashboard/sales",
    metadata: {
      saleId: createdSale.id,
      productId,
      productName,
      sku: product.sku,
      quantity,
      sellingPrice,
      unitCost,
      totalAmount,
      profitAmount,
      previousStock: currentOnHand,
      remainingStock: finalOnHand,
      cashAccountId: selectedAccount.id,
      cashAccountName: selectedAccount.name,
      ledgerPosted: true,
    },
  });

  revalidateSalesPages();

  redirect("/dashboard/sales?success=Sale recorded successfully.");
}


async function importSales(
  rows: ImportedSaleRow[]
): Promise<{
  imported: number;
  failed: number;
  skipped: number;
}> {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  let imported = 0;
  let failed = 0;
  let skipped = 0;

  const salesCategory = await getSalesCategory(
    supabase,
    profile.company_id
  );

  for (const row of rows) {
    let createdSaleId: string | null = null;
    let productSnapshot:
      | {
          id: string;
          quantity_sold: number;
          quantity_on_hand: number;
        }
      | null = null;

    try {
      const saleDate = String(row.sale_date || "").trim();
      const reference = String(row.reference || "").trim();
      const sku = String(row.sku || "").trim();
      const accountName = String(row.account || "").trim();
      const customer = String(row.customer || "").trim();
      const paymentMethod = String(
        row.payment_method || ""
      ).trim();
      const notes = String(row.notes || "").trim();

      const quantity = Number(row.quantity || 0);
      const unitPrice = Number(row.unit_price || 0);
      const discount = Number(row.discount || 0);
      const tax = Number(row.tax || 0);

      if (
        !saleDate ||
        !reference ||
        !sku ||
        !accountName ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0 ||
        !Number.isFinite(discount) ||
        discount < 0 ||
        !Number.isFinite(tax) ||
        tax < 0
      ) {
        failed++;
        continue;
      }

      const parsedSaleDate = new Date(`${saleDate}T12:00:00.000Z`);

      if (Number.isNaN(parsedSaleDate.getTime())) {
        failed++;
        continue;
      }

      const { data: existingReference, error: referenceError } =
        await supabase
          .from("cash_ledger")
          .select("id")
          .eq("company_id", profile.company_id)
          .eq("source_type", "sale")
          .ilike("reference", reference)
          .limit(1)
          .maybeSingle();

      if (referenceError) {
        failed++;
        continue;
      }

      if (existingReference?.id) {
        skipped++;
        continue;
      }

      const { data: product, error: productError } =
        await supabase
          .from("products")
          .select(
            "id, item_name, name, sku, quantity_sold, quantity_on_hand, price_per_piece"
          )
          .eq("company_id", profile.company_id)
          .ilike("sku", sku)
          .limit(1)
          .maybeSingle();

      if (productError || !product) {
        failed++;
        continue;
      }

      const { data: selectedAccount, error: accountError } =
        await supabase
          .from("cash_accounts")
          .select("id, name, account_type, currency, status")
          .eq("company_id", profile.company_id)
          .eq("status", "active")
          .ilike("name", accountName)
          .limit(1)
          .maybeSingle();

      if (accountError || !selectedAccount) {
        failed++;
        continue;
      }

      const currentOnHand = Number(product.quantity_on_hand || 0);
      const currentSold = Number(product.quantity_sold || 0);
      const unitCost = Number(product.price_per_piece || 0);

      if (quantity > currentOnHand) {
        failed++;
        continue;
      }

      const grossAmount = unitPrice * quantity;
      const totalAmount = Math.max(
        grossAmount - discount + tax,
        0
      );

      if (totalAmount <= 0) {
        failed++;
        continue;
      }

      const effectiveSalePrice = totalAmount / quantity;
      const profitAmount =
        (effectiveSalePrice - unitCost) * quantity;
      const finalOnHand = currentOnHand - quantity;
      const finalSold = currentSold + quantity;
      const soldAt = parsedSaleDate.toISOString();
      const productName = getProductName(product);

      productSnapshot = {
        id: product.id,
        quantity_sold: currentSold,
        quantity_on_hand: currentOnHand,
      };

      const { data: createdSale, error: saleError } =
        await supabase
          .from("sales")
          .insert({
            company_id: profile.company_id,
            product_id: product.id,
            quantity,
            sale_price: effectiveSalePrice,
            unit_cost: unitCost,
            total_amount: totalAmount,
            profit_amount: profitAmount,
            created_by: user.id,
            sold_at: soldAt,
          })
          .select("id")
          .single();

      if (saleError || !createdSale) {
        failed++;
        continue;
      }

      createdSaleId = createdSale.id;

      const { error: stockError } = await supabase
        .from("products")
        .update({
          quantity_sold: finalSold,
          quantity_on_hand: finalOnHand,
          stock_quantity: finalOnHand,
        })
        .eq("id", product.id)
        .eq("company_id", profile.company_id);

      if (stockError) {
        await supabase
          .from("sales")
          .delete()
          .eq("id", createdSale.id)
          .eq("company_id", profile.company_id);

        failed++;
        continue;
      }

      const { error: ledgerError } = await supabase
        .from("cash_ledger")
        .insert({
          company_id: profile.company_id,
          account_id: selectedAccount.id,
          category_id: salesCategory.categoryId,
          source_type: "sale",
          source_id: createdSale.id,
          direction: "inflow",
          amount: totalAmount,
          category: salesCategory.categoryName,
          description: `${quantity} × ${productName}`,
          reference,
          transaction_date: getDateOnly(soldAt),
          status: "completed",
          reconciled: false,
          created_by: user.id,
          metadata: {
            saleId: createdSale.id,
            imported: true,
            productId: product.id,
            productName,
            sku: product.sku,
            quantity,
            listedUnitPrice: unitPrice,
            effectiveSalePrice,
            unitCost,
            grossAmount,
            discount,
            tax,
            totalAmount,
            profitAmount,
            customer,
            paymentMethod,
            notes,
            accountId: selectedAccount.id,
            accountName: selectedAccount.name,
            accountType: selectedAccount.account_type,
            accountCurrency: selectedAccount.currency,
          },
        });

      if (ledgerError) {
        await supabase
          .from("products")
          .update({
            quantity_sold: currentSold,
            quantity_on_hand: currentOnHand,
            stock_quantity: currentOnHand,
          })
          .eq("id", product.id)
          .eq("company_id", profile.company_id);

        await supabase
          .from("sales")
          .delete()
          .eq("id", createdSale.id)
          .eq("company_id", profile.company_id);

        failed++;
        continue;
      }

      imported++;
    } catch (error) {
      console.error("Sale CSV row import failed:", error);

      if (productSnapshot) {
        await supabase
          .from("products")
          .update({
            quantity_sold: productSnapshot.quantity_sold,
            quantity_on_hand: productSnapshot.quantity_on_hand,
            stock_quantity: productSnapshot.quantity_on_hand,
          })
          .eq("id", productSnapshot.id)
          .eq("company_id", profile.company_id);
      }

      if (createdSaleId) {
        await supabase
          .from("cash_ledger")
          .delete()
          .eq("company_id", profile.company_id)
          .eq("source_type", "sale")
          .eq("source_id", createdSaleId);

        await supabase
          .from("sales")
          .delete()
          .eq("id", createdSaleId)
          .eq("company_id", profile.company_id);
      }

      failed++;
    }
  }

  if (imported > 0) {
    await emitEvent({
      companyId: profile.company_id,
      actorId: user.id,
      recipients: [user.id],
      type: "sales_imported",
      title: "Sales imported",
      message: `${imported} sale${
        imported === 1 ? "" : "s"
      } imported. Inventory and Accounts were updated.`,
      actionUrl: "/dashboard/sales",
      metadata: {
        imported,
        failed,
        skipped,
        importedBy: user.id,
        importedAt: new Date().toISOString(),
      },
    });
  }

  revalidateSalesPages();

  return {
    imported,
    failed,
    skipped,
  };
}

async function updateSale(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const saleId = String(formData.get("id") || "");
  const requestedAccountId = String(
    formData.get("account_id") || ""
  ).trim();
  const newQuantity = Number(formData.get("quantity") || 0);
  const newSellingPrice = Number(formData.get("selling_price") || 0);

  if (!saleId) {
    redirect("/dashboard/sales?error=Sale not found.");
  }

  if (
    !Number.isFinite(newQuantity) ||
    !Number.isFinite(newSellingPrice) ||
    newQuantity <= 0 ||
    newSellingPrice <= 0
  ) {
    redirect(
      "/dashboard/sales?error=Enter a valid quantity and selling price."
    );
  }

  const { data: sale, error: saleLookupError } = await supabase
    .from("sales")
    .select(
      "id, product_id, quantity, sale_price, unit_cost, total_amount, profit_amount, sold_at, created_by, notes"
    )
    .eq("id", saleId)
    .eq("company_id", profile.company_id)
    .single();

  if (saleLookupError || !sale) {
    redirect("/dashboard/sales?error=Sale not found.");
  }

  const { data: product, error: productLookupError } = await supabase
    .from("products")
    .select(
      "id, item_name, name, sku, quantity_sold, quantity_on_hand, price_per_piece"
    )
    .eq("id", sale.product_id)
    .eq("company_id", profile.company_id)
    .single();

  if (productLookupError || !product) {
    redirect("/dashboard/sales?error=Product not found.");
  }

  const { data: existingLedger } = await supabase
    .from("cash_ledger")
    .select(
      "id, account_id, category_id, amount, description, metadata, status"
    )
    .eq("company_id", profile.company_id)
    .in("source_type", ["sale", "employee_sale"])
    .eq("source_id", saleId)
    .maybeSingle();

  if (!existingLedger) {
    redirect(
      "/dashboard/sales?error=The Accounts ledger entry for this sale could not be found. The sale was not changed."
    );
  }

  const targetAccountId =
    requestedAccountId || existingLedger.account_id || "";

  const selectedAccount = await getSelectedSalesAccount(
    supabase,
    profile.company_id,
    targetAccountId
  );

  if (!selectedAccount) {
    redirect(
      "/dashboard/sales?error=Select a valid active financial account for this sale."
    );
  }

  const oldQuantity = Number(sale.quantity || 0);
  const oldSellingPrice = Number(sale.sale_price || 0);
  const oldTotalAmount = Number(sale.total_amount || 0);
  const oldProfitAmount = Number(sale.profit_amount || 0);

  const currentSold = Number(product.quantity_sold || 0);
  const currentOnHand = Number(product.quantity_on_hand || 0);
  const unitCost = Number(product.price_per_piece || 0);

  const restoredOnHand = currentOnHand + oldQuantity;
  const restoredSold = Math.max(currentSold - oldQuantity, 0);

  if (newQuantity > restoredOnHand) {
    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        `Not enough inventory. Available: ${restoredOnHand}. Requested: ${newQuantity}.`
      )}`
    );
  }

  const finalOnHand = restoredOnHand - newQuantity;
  const finalSold = restoredSold + newQuantity;
  const totalAmount = newSellingPrice * newQuantity;
  const profitAmount = (newSellingPrice - unitCost) * newQuantity;
  const productName = getProductName(product);

  const { error: saleError } = await supabase
    .from("sales")
    .update({
      quantity: newQuantity,
      sale_price: newSellingPrice,
      unit_cost: unitCost,
      total_amount: totalAmount,
      profit_amount: profitAmount,
    })
    .eq("id", saleId)
    .eq("company_id", profile.company_id);

  if (saleError) {
    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        saleError.message
      )}`
    );
  }

  const { error: productError } = await supabase
    .from("products")
    .update({
      quantity_sold: finalSold,
      quantity_on_hand: finalOnHand,
      stock_quantity: finalOnHand,
    })
    .eq("id", sale.product_id)
    .eq("company_id", profile.company_id);

  if (productError) {
    await supabase
      .from("sales")
      .update({
        quantity: oldQuantity,
        sale_price: oldSellingPrice,
        unit_cost: unitCost,
        total_amount: oldTotalAmount,
        profit_amount: oldProfitAmount,
      })
      .eq("id", saleId)
      .eq("company_id", profile.company_id);

    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        productError.message
      )}`
    );
  }

  const { error: ledgerError } = await supabase
    .from("cash_ledger")
    .update({
      account_id: selectedAccount.id,
      amount: totalAmount,
      description: `${newQuantity} × ${productName}`,
      transaction_date: getDateOnly(sale.sold_at),
      status: "completed",
      metadata: {
        saleId,
        productId: sale.product_id,
        productName,
        sku: product.sku,
        quantity: newQuantity,
        sellingPrice: newSellingPrice,
        unitCost,
        totalAmount,
        profitAmount,
        previousAmount: oldTotalAmount,
        previousAccountId: existingLedger.account_id,
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        accountType: selectedAccount.account_type,
        accountCurrency: selectedAccount.currency,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq("id", existingLedger.id)
    .eq("company_id", profile.company_id);

  if (ledgerError) {
    await supabase
      .from("products")
      .update({
        quantity_sold: currentSold,
        quantity_on_hand: currentOnHand,
        stock_quantity: currentOnHand,
      })
      .eq("id", sale.product_id)
      .eq("company_id", profile.company_id);

    await supabase
      .from("sales")
      .update({
        quantity: oldQuantity,
        sale_price: oldSellingPrice,
        unit_cost: sale.unit_cost,
        total_amount: oldTotalAmount,
        profit_amount: oldProfitAmount,
      })
      .eq("id", saleId)
      .eq("company_id", profile.company_id);

    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        `The sale was not changed because its Accounts ledger entry could not be updated: ${ledgerError.message}`
      )}`
    );
  }

  const changes: string[] = [];

  if (oldQuantity !== newQuantity) {
    changes.push(`quantity ${oldQuantity} → ${newQuantity}`);
  }

  if (oldSellingPrice !== newSellingPrice) {
    changes.push(
      `selling price ${oldSellingPrice.toFixed(
        2
      )} → ${newSellingPrice.toFixed(2)}`
    );
  }

  if (oldTotalAmount !== totalAmount) {
    changes.push(
      `total ${oldTotalAmount.toFixed(2)} → ${totalAmount.toFixed(2)}`
    );
  }

  if (oldProfitAmount !== profitAmount) {
    changes.push(
      `profit ${oldProfitAmount.toFixed(2)} → ${profitAmount.toFixed(2)}`
    );
  }

  if (existingLedger.account_id !== selectedAccount.id) {
    changes.push(`receiving account → ${selectedAccount.name}`);
  }

  const message =
    changes.length > 0
      ? `${productName}: ${changes.join(
          "; "
        )}. The Accounts ledger was updated.`
      : `${productName} was saved with no visible changes.`;

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "sale_updated",
    title: "Sale updated",
    message,
    actionUrl: "/dashboard/sales",
    metadata: {
      saleId,
      productId: sale.product_id,
      productName,
      sku: product.sku,
      changedFields: changes,
      previous: {
        quantity: oldQuantity,
        sellingPrice: oldSellingPrice,
        totalAmount: oldTotalAmount,
        profitAmount: oldProfitAmount,
      },
      updated: {
        quantity: newQuantity,
        sellingPrice: newSellingPrice,
        totalAmount,
        profitAmount,
      },
      remainingStock: finalOnHand,
      ledgerEntryId: existingLedger.id,
      previousCashAccountId: existingLedger.account_id,
      cashAccountId: selectedAccount.id,
      cashAccountName: selectedAccount.name,
      ledgerUpdated: true,
    },
  });

  revalidateSalesPages();

  redirect(
    "/dashboard/sales?success=Sale, inventory and Accounts ledger updated successfully."
  );
}

async function deleteSale(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const saleId = String(formData.get("id") || "");

  if (!saleId) {
    redirect("/dashboard/sales?error=Sale not found.");
  }

  const { data: sale, error: saleLookupError } = await supabase
    .from("sales")
    .select(
      "id, product_id, quantity, sale_price, unit_cost, total_amount, profit_amount, sold_at, created_by, notes"
    )
    .eq("id", saleId)
    .eq("company_id", profile.company_id)
    .single();

  if (saleLookupError || !sale) {
    redirect("/dashboard/sales?error=Sale not found.");
  }

  const { data: product, error: productLookupError } = await supabase
    .from("products")
    .select(
      "id, item_name, name, sku, quantity_sold, quantity_on_hand"
    )
    .eq("id", sale.product_id)
    .eq("company_id", profile.company_id)
    .single();

  if (productLookupError || !product) {
    redirect("/dashboard/sales?error=Product not found.");
  }

  const { data: ledgerEntry } = await supabase
    .from("cash_ledger")
    .select("id, status, metadata")
    .eq("company_id", profile.company_id)
    .in("source_type", ["sale", "employee_sale"])
    .eq("source_id", saleId)
    .maybeSingle();

  if (!ledgerEntry) {
    redirect(
      "/dashboard/sales?error=The Accounts ledger entry for this sale could not be found. The sale was not deleted."
    );
  }

  const saleQuantity = Number(sale.quantity || 0);
  const currentSold = Number(product.quantity_sold || 0);
  const currentOnHand = Number(product.quantity_on_hand || 0);

  const restoredSold = Math.max(currentSold - saleQuantity, 0);
  const restoredOnHand = currentOnHand + saleQuantity;

  const { error: deleteError } = await supabase
    .from("sales")
    .delete()
    .eq("id", saleId)
    .eq("company_id", profile.company_id);

  if (deleteError) {
    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        deleteError.message
      )}`
    );
  }

  const { error: productError } = await supabase
    .from("products")
    .update({
      quantity_sold: restoredSold,
      quantity_on_hand: restoredOnHand,
      stock_quantity: restoredOnHand,
    })
    .eq("id", sale.product_id)
    .eq("company_id", profile.company_id);

  if (productError) {
    await supabase.from("sales").insert({
      id: sale.id,
      company_id: profile.company_id,
      product_id: sale.product_id,
      quantity: sale.quantity,
      sale_price: sale.sale_price,
      unit_cost: sale.unit_cost,
      total_amount: sale.total_amount,
      profit_amount: sale.profit_amount,
      created_by: sale.created_by || user.id,
      sold_at: sale.sold_at,
    });

    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        productError.message
      )}`
    );
  }

  const { error: ledgerError } = await supabase
    .from("cash_ledger")
    .update({
      status: "reversed",
      reconciled: false,
      reconciled_at: null,
      metadata: {
        ...(ledgerEntry.metadata &&
        typeof ledgerEntry.metadata === "object"
          ? ledgerEntry.metadata
          : {}),
        reversedAt: new Date().toISOString(),
        reversedBy: user.id,
        reversalReason: "Source sale deleted",
      },
    })
    .eq("id", ledgerEntry.id)
    .eq("company_id", profile.company_id);

  if (ledgerError) {
    await supabase
      .from("products")
      .update({
        quantity_sold: currentSold,
        quantity_on_hand: currentOnHand,
        stock_quantity: currentOnHand,
      })
      .eq("id", sale.product_id)
      .eq("company_id", profile.company_id);

    await supabase.from("sales").insert({
      id: sale.id,
      company_id: profile.company_id,
      product_id: sale.product_id,
      quantity: sale.quantity,
      sale_price: sale.sale_price,
      unit_cost: sale.unit_cost,
      total_amount: sale.total_amount,
      profit_amount: sale.profit_amount,
      created_by: sale.created_by || user.id,
      sold_at: sale.sold_at,
    });

    redirect(
      `/dashboard/sales?error=${encodeURIComponent(
        `The sale was not deleted because its Accounts ledger entry could not be reversed: ${ledgerError.message}`
      )}`
    );
  }

  const productName = getProductName(product);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "sale_deleted",
    title: "Sale deleted",
    message: `A sale of ${saleQuantity} × ${productName} was deleted, inventory was restored and its Accounts entry was reversed.`,
    actionUrl: "/dashboard/sales",
    metadata: {
      saleId,
      productId: sale.product_id,
      productName,
      sku: product.sku,
      quantity: saleQuantity,
      salePrice: Number(sale.sale_price || 0),
      unitCost: Number(sale.unit_cost || 0),
      totalAmount: Number(sale.total_amount || 0),
      profitAmount: Number(sale.profit_amount || 0),
      previousStock: currentOnHand,
      restoredStock: restoredOnHand,
      ledgerEntryId: ledgerEntry.id,
      ledgerReversed: true,
    },
  });

  revalidateSalesPages();

  redirect(
    "/dashboard/sales?success=Sale deleted, inventory restored and Accounts entry reversed."
  );
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAdminProfile();

  const [
    { data: products },
    { data: sales },
    { data: company },
    { data: accountRows },
    { data: ledgerBalanceRows },
    notifications,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, item_name, name, sku, quantity_sold, quantity_on_hand, quantity_bought, price_per_piece, selling_price, total_cost"
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),

    supabase
      .from("sales")
      .select(
        "id, quantity, sale_price, unit_cost, total_amount, profit_amount, sold_at, products(item_name, name, sku), created_by, notes"
      )
      .eq("company_id", profile.company_id)
      .order("sold_at", { ascending: false }),

    supabase
      .from("companies")
      .select("currency")
      .eq("id", profile.company_id)
      .single(),

    supabase
      .from("cash_accounts")
      .select(
        "id, name, account_type, currency, status, opening_balance"
      )
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),

    supabase
      .from("cash_ledger")
      .select("account_id, direction, amount, status")
      .eq("company_id", profile.company_id)
      .eq("status", "completed"),

    getUserNotifications(user.id),
  ]);

  const accountBalances = new Map<string, number>();

  for (const account of
    (accountRows || []) as SalesCashAccountRow[]) {
    accountBalances.set(
      account.id,
      Number(account.opening_balance || 0)
    );
  }

  for (const transaction of
    (ledgerBalanceRows || []) as SalesLedgerBalanceRow[]) {
    if (!transaction.account_id || transaction.status !== "completed") {
      continue;
    }

    const currentBalance =
      accountBalances.get(transaction.account_id) || 0;
    const amount = Number(transaction.amount || 0);

    if (!Number.isFinite(amount)) continue;

    if (transaction.direction === "inflow") {
      accountBalances.set(
        transaction.account_id,
        currentBalance + amount
      );
    } else if (transaction.direction === "outflow") {
      accountBalances.set(
        transaction.account_id,
        currentBalance - amount
      );
    }
  }

  const accounts: SalesCashAccount[] = (
    (accountRows || []) as SalesCashAccountRow[]
  ).map((account) => ({
    id: account.id,
    name: account.name,
    account_type: account.account_type,
    currency: account.currency,
    status: account.status,
    balance:
      Math.round(
        (accountBalances.get(account.id) || 0) * 100
      ) / 100,
  }));

    const salesForClient = await attachSaleRecorderDetails(
    supabase,
    (sales || []) as SaleWithRecorderDetails[]
  );

return (
    <SalesClient
      products={(products || []) as ProductRow[]}
      sales={salesForClient as Sale[]}
      accounts={accounts}
      error={params?.error}
      success={params?.success}
      recordSale={recordSale}
      importSales={importSales}
      updateSale={updateSale}
      deleteSale={deleteSale}
      adminName={profile.full_name || user.email || "Founder"}
      currency={company?.currency || "USD"}
      notifications={notifications}
      userId={user.id}
    />
  );
}