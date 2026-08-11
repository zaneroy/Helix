import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import ProductsClient from "./ProductsClient";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";


export type ImportedProductRow = {
  item_name?: string;
  name?: string;
  product_name?: string;
  sku?: string;
  supplier?: string;
  vendor?: string;
  quantity_bought?: number | string;
  quantity?: number | string;
  stock_quantity?: number | string;
  total_cost?: number | string;
  cost_price?: number | string;
  selling_price?: number | string;
  sale_price?: number | string;
  low_stock_limit?: number | string;
  reorder_level?: number | string;
  delivery_date?: string;
  date?: string;
  notes?: string;
};

function getProductErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "23505") {
    return "A product with this SKU already exists.";
  }

  if (error.code === "23514") {
    return "Stock must be at least 1 and prices cannot be negative.";
  }

  return error.message || "Something went wrong.";
}

function displayValue(value: string | null | undefined) {
  const normalizedValue = String(value || "").trim();

  return normalizedValue || "blank";
}

function numbersAreDifferent(first: number, second: number) {
  return Math.abs(first - second) > 0.000001;
}

async function getAdminContext() {
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

async function addProduct(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const itemName = String(formData.get("item_name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const supplier = String(formData.get("supplier") || "").trim();
  const quantityBought = Number(formData.get("quantity_bought") || 1);
  const totalCost = Number(formData.get("total_cost") || 0);
  const pricePerPiece =
    quantityBought > 0 ? totalCost / quantityBought : 0;
  const sellingPrice = Number(formData.get("selling_price") || 0);
  const lowStockLimit = Number(
    formData.get("low_stock_limit") || 1
  );
  const deliveryDate =
    String(formData.get("delivery_date") || "") || null;
  const notes = String(formData.get("notes") || "").trim();

  const { data: createdProduct, error } = await supabase
    .from("products")
    .insert({
      company_id: profile.company_id,
      name: itemName,
      item_name: itemName,
      sku,
      supplier,
      total_cost: totalCost,
      cost_price: totalCost,
      quantity_bought: quantityBought,
      quantity_sold: 0,
      quantity_on_hand: quantityBought,
      stock_quantity: quantityBought,
      price_per_piece: pricePerPiece,
      low_stock_limit: lowStockLimit,
      selling_price: sellingPrice,
      sale_price: sellingPrice,
      delivery_date: deliveryDate,
      notes,
    })
    .select("id, item_name, name, sku")
    .single();

  if (error) {
    redirect(
      `/dashboard/products?error=${encodeURIComponent(
        getProductErrorMessage(error)
      )}`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "product_created",
    title: "Product added",
    message: `${
      createdProduct?.item_name ||
      createdProduct?.name ||
      "Product"
    } was added to inventory.`,
    actionUrl: "/dashboard/products",
    metadata: {
      productId: createdProduct?.id,
      itemName,
      sku: createdProduct?.sku,
      supplier,
      quantityBought,
      quantityOnHand: quantityBought,
      totalCost,
      pricePerPiece,
      sellingPrice,
      lowStockLimit,
      deliveryDate,
      notes,
    },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirect(
    "/dashboard/products?success=Product added successfully."
  );
}


async function importProducts(
  rows: ImportedProductRow[]
): Promise<{
  imported: number;
  failed: number;
  skipped: number;
}> {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  let imported = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const itemName = String(
        row.item_name || row.name || row.product_name || ""
      ).trim();

      const sku = String(row.sku || "").trim();

      const supplier = String(
        row.supplier || row.vendor || ""
      ).trim();

      const quantityBought = Number(
        row.quantity_bought ||
          row.quantity ||
          row.stock_quantity ||
          0
      );

      const totalCost = Number(
        row.total_cost || row.cost_price || 0
      );

      const sellingPrice = Number(
        row.selling_price || row.sale_price || 0
      );

      const lowStockLimit = Number(
        row.low_stock_limit || row.reorder_level || 1
      );

      const deliveryDate =
        String(row.delivery_date || row.date || "").trim() || null;

      const notes = String(row.notes || "").trim();

      if (
        !itemName ||
        !sku ||
        !Number.isFinite(quantityBought) ||
        quantityBought < 1 ||
        !Number.isFinite(totalCost) ||
        totalCost < 0 ||
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0 ||
        !Number.isFinite(lowStockLimit) ||
        lowStockLimit < 0
      ) {
        failed++;
        continue;
      }

      const { data: duplicate, error: duplicateError } =
        await supabase
          .from("products")
          .select("id")
          .eq("company_id", profile.company_id)
          .ilike("sku", sku)
          .limit(1)
          .maybeSingle();

      if (duplicateError) {
        failed++;
        continue;
      }

      if (duplicate?.id) {
        skipped++;
        continue;
      }

      const pricePerPiece =
        quantityBought > 0 ? totalCost / quantityBought : 0;

      const { data: createdProduct, error } = await supabase
        .from("products")
        .insert({
          company_id: profile.company_id,
          name: itemName,
          item_name: itemName,
          sku,
          supplier,
          total_cost: totalCost,
          cost_price: totalCost,
          quantity_bought: quantityBought,
          quantity_sold: 0,
          quantity_on_hand: quantityBought,
          stock_quantity: quantityBought,
          price_per_piece: pricePerPiece,
          low_stock_limit: lowStockLimit,
          selling_price: sellingPrice,
          sale_price: sellingPrice,
          delivery_date: deliveryDate,
          notes,
        })
        .select("id, item_name, name, sku")
        .single();

      if (error || !createdProduct) {
        if (error?.code === "23505") {
          skipped++;
        } else {
          failed++;
        }

        continue;
      }

      imported++;
    } catch (error) {
      console.error("Product CSV row import failed:", error);
      failed++;
    }
  }

  if (imported > 0) {
    await emitEvent({
      companyId: profile.company_id,
      actorId: user.id,
      recipients: [user.id],
      type: "products_imported",
      title: "Products imported",
      message: `${imported} product${
        imported === 1 ? "" : "s"
      } imported into inventory from CSV.`,
      actionUrl: "/dashboard/products",
      metadata: {
        imported,
        failed,
        skipped,
        importedBy: user.id,
        importedAt: new Date().toISOString(),
      },
    });
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  return {
    imported,
    failed,
    skipped,
  };
}

async function updateProduct(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const productId = String(formData.get("id") || "");
  const itemName = String(formData.get("item_name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const supplier = String(formData.get("supplier") || "").trim();
  const quantityBought = Number(
    formData.get("quantity_bought") || 1
  );
  const totalCost = Number(formData.get("total_cost") || 0);
  const sellingPrice = Number(
    formData.get("selling_price") || 0
  );
  const lowStockLimit = Number(
    formData.get("low_stock_limit") || 1
  );
  const deliveryDate =
    String(formData.get("delivery_date") || "") || null;
  const notes = String(formData.get("notes") || "").trim();

  if (!productId) {
    redirect("/dashboard/products?error=Product not found.");
  }

  const { data: currentProduct, error: lookupError } =
    await supabase
      .from("products")
      .select(
        `
          id,
          name,
          item_name,
          sku,
          supplier,
          total_cost,
          cost_price,
          quantity_bought,
          quantity_sold,
          quantity_on_hand,
          stock_quantity,
          price_per_piece,
          selling_price,
          sale_price,
          low_stock_limit,
          delivery_date,
          notes
        `
      )
      .eq("id", productId)
      .eq("company_id", profile.company_id)
      .single();

  if (lookupError || !currentProduct) {
    redirect("/dashboard/products?error=Product not found.");
  }

  const quantitySold = Number(
    currentProduct.quantity_sold || 0
  );

  const quantityOnHand = Math.max(
    quantityBought - quantitySold,
    0
  );

  const pricePerPiece =
    quantityBought > 0 ? totalCost / quantityBought : 0;

  const { error } = await supabase
    .from("products")
    .update({
      name: itemName,
      item_name: itemName,
      sku,
      supplier,
      total_cost: totalCost,
      cost_price: totalCost,
      quantity_bought: quantityBought,
      quantity_sold: quantitySold,
      quantity_on_hand: quantityOnHand,
      stock_quantity: quantityOnHand,
      price_per_piece: pricePerPiece,
      selling_price: sellingPrice,
      sale_price: sellingPrice,
      low_stock_limit: lowStockLimit,
      delivery_date: deliveryDate,
      notes,
    })
    .eq("id", productId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/products?error=${encodeURIComponent(
        getProductErrorMessage(error)
      )}`
    );
  }

  const previousItemName =
    currentProduct.item_name || currentProduct.name || "";

  const previousSku = currentProduct.sku || "";
  const previousSupplier = currentProduct.supplier || "";
  const previousTotalCost = Number(
    currentProduct.total_cost || 0
  );
  const previousQuantityBought = Number(
    currentProduct.quantity_bought || 0
  );
  const previousQuantityOnHand = Number(
    currentProduct.quantity_on_hand || 0
  );
  const previousPricePerPiece = Number(
    currentProduct.price_per_piece || 0
  );
  const previousSellingPrice = Number(
    currentProduct.selling_price || 0
  );
  const previousLowStockLimit = Number(
    currentProduct.low_stock_limit || 0
  );
  const previousDeliveryDate =
    currentProduct.delivery_date || null;
  const previousNotes = currentProduct.notes || "";

  const changes: string[] = [];

  if (previousItemName !== itemName) {
    changes.push(
      `item name "${displayValue(
        previousItemName
      )}" → "${displayValue(itemName)}"`
    );
  }

  if (previousSku !== sku) {
    changes.push(
      `SKU "${displayValue(previousSku)}" → "${displayValue(
        sku
      )}"`
    );
  }

  if (previousSupplier !== supplier) {
    changes.push(
      `supplier "${displayValue(
        previousSupplier
      )}" → "${displayValue(supplier)}"`
    );
  }

  if (numbersAreDifferent(previousTotalCost, totalCost)) {
    changes.push(
      `total cost ${previousTotalCost.toFixed(
        2
      )} → ${totalCost.toFixed(2)}`
    );
  }

  if (previousQuantityBought !== quantityBought) {
    changes.push(
      `quantity bought ${previousQuantityBought} → ${quantityBought}`
    );
  }

  if (previousQuantityOnHand !== quantityOnHand) {
    changes.push(
      `quantity on hand ${previousQuantityOnHand} → ${quantityOnHand}`
    );
  }

  if (
    numbersAreDifferent(
      previousPricePerPiece,
      pricePerPiece
    )
  ) {
    changes.push(
      `unit cost ${previousPricePerPiece.toFixed(
        2
      )} → ${pricePerPiece.toFixed(2)}`
    );
  }

  if (
    numbersAreDifferent(
      previousSellingPrice,
      sellingPrice
    )
  ) {
    changes.push(
      `selling price ${previousSellingPrice.toFixed(
        2
      )} → ${sellingPrice.toFixed(2)}`
    );
  }

  if (previousLowStockLimit !== lowStockLimit) {
    changes.push(
      `low-stock limit ${previousLowStockLimit} → ${lowStockLimit}`
    );
  }

  if (previousDeliveryDate !== deliveryDate) {
    changes.push(
      `delivery date "${displayValue(
        previousDeliveryDate
      )}" → "${displayValue(deliveryDate)}"`
    );
  }

  if (previousNotes !== notes) {
    changes.push("notes updated");
  }

  const productName =
    itemName || previousItemName || sku || "Product";

  const message =
    changes.length > 0
      ? `${productName}: ${changes.join("; ")}.`
      : `${productName} was saved with no visible field changes.`;

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "product_updated",
    title: "Product updated",
    message,
    actionUrl: "/dashboard/products",
    metadata: {
      productId,
      changedFields: changes,
      previous: {
        itemName: previousItemName,
        sku: previousSku,
        supplier: previousSupplier,
        totalCost: previousTotalCost,
        quantityBought: previousQuantityBought,
        quantitySold,
        quantityOnHand: previousQuantityOnHand,
        pricePerPiece: previousPricePerPiece,
        sellingPrice: previousSellingPrice,
        lowStockLimit: previousLowStockLimit,
        deliveryDate: previousDeliveryDate,
        notes: previousNotes,
      },
      updated: {
        itemName,
        sku,
        supplier,
        totalCost,
        quantityBought,
        quantitySold,
        quantityOnHand,
        pricePerPiece,
        sellingPrice,
        lowStockLimit,
        deliveryDate,
        notes,
      },
    },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirect(
    "/dashboard/products?success=Product updated successfully."
  );
}

async function deleteProduct(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const productId = String(formData.get("id") || "");

  if (!productId) {
    redirect("/dashboard/products?error=Product not found.");
  }

  const { count } = await supabase
    .from("sales")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("product_id", productId);

  if (count && count > 0) {
    redirect(
      "/dashboard/products?error=This product has sales history. You cannot delete it."
    );
  }

  const { data: product, error: lookupError } = await supabase
    .from("products")
    .select(
      `
        id,
        item_name,
        name,
        sku,
        supplier,
        total_cost,
        quantity_bought,
        quantity_sold,
        quantity_on_hand,
        price_per_piece,
        selling_price,
        low_stock_limit,
        delivery_date,
        notes
      `
    )
    .eq("id", productId)
    .eq("company_id", profile.company_id)
    .single();

  if (lookupError || !product) {
    redirect("/dashboard/products?error=Product not found.");
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/products?error=${encodeURIComponent(
        getProductErrorMessage(error)
      )}`
    );
  }

  const productName =
    product.item_name || product.name || product.sku || "Product";

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "product_deleted",
    title: "Product deleted",
    message: `${productName} was deleted from inventory.`,
    actionUrl: "/dashboard/products",
    metadata: {
      productId,
      itemName: product.item_name || product.name,
      sku: product.sku,
      supplier: product.supplier,
      totalCost: Number(product.total_cost || 0),
      quantityBought: Number(product.quantity_bought || 0),
      quantitySold: Number(product.quantity_sold || 0),
      quantityOnHand: Number(product.quantity_on_hand || 0),
      pricePerPiece: Number(product.price_per_piece || 0),
      sellingPrice: Number(product.selling_price || 0),
      lowStockLimit: Number(product.low_stock_limit || 0),
      deliveryDate: product.delivery_date,
      notes: product.notes,
    },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirect(
    "/dashboard/products?success=Product deleted successfully."
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAdminContext();

  const [
    { data: products },
    { data: company },
    notifications,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),

    supabase
      .from("companies")
      .select("currency")
      .eq("id", profile.company_id)
      .single(),

    getUserNotifications(user.id),
  ]);

  return (
    <ProductsClient
      products={products || []}
      error={params?.error}
      success={params?.success}
      addProduct={addProduct}
      importProducts={importProducts}
      updateProduct={updateProduct}
      deleteProduct={deleteProduct}
      adminName={profile.full_name || user.email || "Founder"}
      currency={company?.currency || "USD"}
      notifications={notifications}
      userId={user.id}
    />
  );
}