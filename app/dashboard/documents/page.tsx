import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import AdminDocumentsClient from "./AdminDocumentsClient";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";

export type AdminCompanyDocument = {
  id: string;
  title: string;
  category: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  visibility: "admin_only" | "investors";
  created_at: string;
};

export type DocumentDownloadResult = {
  url: string | null;
  error: string | null;
};

const allowedCategories = [
  "legal",
  "tax",
  "board",
  "financial",
  "cap_table",
  "other",
];

const allowedVisibility = ["admin_only", "investors"];

function formatCategory(category: string) {
  return category
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatVisibility(visibility: string) {
  return visibility === "investors" ? "Investors" : "Admin only";
}

function formatFileSize(bytes: number | null | undefined) {
  const size = Number(bytes || 0);

  if (size <= 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  return { supabase, user, profile };
}

async function getCompanyInvestorIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
) {
  const { data: investors, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "investor");

  if (error) {
    console.error("Unable to retrieve company investors:", error);
    return [];
  }

  return (investors || []).map((investor) => investor.id);
}

async function uploadCompanyDocument(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "");
  const visibility = String(formData.get("visibility") || "");
  const file = formData.get("file") as File | null;

  if (!title) {
    redirect("/dashboard/documents?error=Document title is required.");
  }

  if (!allowedCategories.includes(category)) {
    redirect("/dashboard/documents?error=Invalid document category.");
  }

  if (!allowedVisibility.includes(visibility)) {
    redirect("/dashboard/documents?error=Invalid visibility setting.");
  }

  if (!file || file.size <= 0) {
    redirect(
      "/dashboard/documents?error=Please choose a file to upload."
    );
  }

  const safeFileName = file.name.replace(
    /[^a-zA-Z0-9._-]+/g,
    "-"
  );

  const filePath = `${profile.company_id}/uploads/${category}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("company-documents")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    redirect(
      `/dashboard/documents?error=${encodeURIComponent(
        uploadError.message
      )}`
    );
  }

  const { data: createdDocument, error: insertError } =
    await supabase
      .from("company_documents")
      .insert({
        company_id: profile.company_id,
        uploaded_by: profile.id,
        title,
        category,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type || "file",
        file_size: file.size,
        visibility,
      })
      .select(
        "id, title, category, file_name, file_type, file_size, visibility, created_at"
      )
      .single();

  if (insertError) {
    await supabase.storage
      .from("company-documents")
      .remove([filePath]);

    redirect(
      `/dashboard/documents?error=${encodeURIComponent(
        insertError.message
      )}`
    );
  }

  const investorIds =
    visibility === "investors"
      ? await getCompanyInvestorIds(
          supabase,
          profile.company_id
        )
      : [];

  const recipients = Array.from(
    new Set([user.id, ...investorIds])
  );

  const categoryLabel = formatCategory(category);
  const visibilityLabel = formatVisibility(visibility);
  const fileSizeLabel = formatFileSize(file.size);

  const message =
    visibility === "investors"
      ? `"${title}" was uploaded and published to investors. Category: ${categoryLabel}; file: ${file.name}; size: ${fileSizeLabel}.`
      : `"${title}" was uploaded as an admin-only document. Category: ${categoryLabel}; file: ${file.name}; size: ${fileSizeLabel}.`;

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients,
    type:
      visibility === "investors"
        ? "document_published_to_investors"
        : "document_uploaded",
    title:
      visibility === "investors"
        ? "Document published to investors"
        : "Document uploaded",
    message,
    actionUrl:
      visibility === "investors"
        ? "/investor/documents"
        : "/dashboard/documents",
    metadata: {
      documentId: createdDocument?.id,
      title,
      category,
      categoryLabel,
      visibility,
      visibilityLabel,
      fileName: file.name,
      fileType: file.type || "file",
      fileSize: file.size,
      fileSizeLabel,
      investorRecipients: investorIds.length,
    },
  });

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/activity");
  revalidatePath("/investor/documents");
  revalidatePath("/investor");

  redirect(
    "/dashboard/documents?success=Document uploaded successfully."
  );
}

async function downloadCompanyDocument(
  formData: FormData
): Promise<DocumentDownloadResult> {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const documentId = String(
    formData.get("document_id") || ""
  );

  if (!documentId) {
    return {
      url: null,
      error: "Document not found.",
    };
  }

  const { data: document, error: documentError } =
    await supabase
      .from("company_documents")
      .select(
        "id, company_id, title, category, file_path, file_name, file_type, file_size, visibility"
      )
      .eq("id", documentId)
      .eq("company_id", profile.company_id)
      .single();

  if (documentError || !document) {
    console.error(
      "Unable to retrieve document:",
      documentError
    );

    return {
      url: null,
      error: "Document not found.",
    };
  }

  const { data: signedUrlData, error: signedUrlError } =
    await supabase.storage
      .from("company-documents")
      .createSignedUrl(document.file_path, 60, {
        download: document.file_name,
      });

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error(
      "Unable to create document download URL:",
      signedUrlError
    );

    return {
      url: null,
      error: "Unable to create a secure download link.",
    };
  }

  const categoryLabel = formatCategory(document.category);
  const fileSizeLabel = formatFileSize(document.file_size);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "document_downloaded",
    title: "Document downloaded",
    message: `"${document.title}" was downloaded. Category: ${categoryLabel}; file: ${document.file_name}; size: ${fileSizeLabel}.`,
    actionUrl: "/dashboard/documents",
    metadata: {
      documentId: document.id,
      title: document.title,
      category: document.category,
      categoryLabel,
      visibility: document.visibility,
      fileName: document.file_name,
      fileType: document.file_type,
      fileSize: document.file_size,
      fileSizeLabel,
    },
  });

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/activity");

  return {
    url: signedUrlData.signedUrl,
    error: null,
  };
}

async function deleteCompanyDocument(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const documentId = String(
    formData.get("document_id") || ""
  );

  if (!documentId) {
    redirect("/dashboard/documents?error=Document not found.");
  }

  const { data: document, error: documentError } =
    await supabase
      .from("company_documents")
      .select(
        "id, company_id, title, category, file_path, file_name, file_type, file_size, visibility"
      )
      .eq("id", documentId)
      .eq("company_id", profile.company_id)
      .single();

  if (documentError || !document) {
    redirect("/dashboard/documents?error=Document not found.");
  }

  const { error: storageError } = await supabase.storage
    .from("company-documents")
    .remove([document.file_path]);

  if (storageError) {
    redirect(
      `/dashboard/documents?error=${encodeURIComponent(
        storageError.message
      )}`
    );
  }

  const { error: deleteError } = await supabase
    .from("company_documents")
    .delete()
    .eq("id", documentId)
    .eq("company_id", profile.company_id);

  if (deleteError) {
    redirect(
      `/dashboard/documents?error=${encodeURIComponent(
        deleteError.message
      )}`
    );
  }

  const categoryLabel = formatCategory(document.category);
  const visibilityLabel = formatVisibility(
    document.visibility
  );
  const fileSizeLabel = formatFileSize(document.file_size);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "document_deleted",
    title: "Document deleted",
    message: `"${document.title}" was deleted. Category: ${categoryLabel}; visibility: ${visibilityLabel}; file: ${document.file_name}.`,
    actionUrl: "/dashboard/documents",
    metadata: {
      documentId: document.id,
      title: document.title,
      category: document.category,
      categoryLabel,
      visibility: document.visibility,
      visibilityLabel,
      fileName: document.file_name,
      fileType: document.file_type,
      fileSize: document.file_size,
      fileSizeLabel,
    },
  });

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/activity");
  revalidatePath("/investor/documents");
  revalidatePath("/investor");

  redirect(
    "/dashboard/documents?success=Document deleted successfully."
  );
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } =
    await getAdminContext();

  const [{ data: documents }, notifications] =
    await Promise.all([
      supabase
        .from("company_documents")
        .select(
          "id, title, category, file_name, file_path, file_type, file_size, visibility, created_at"
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),

      getUserNotifications(user.id),
    ]);

  return (
    <AdminDocumentsClient
      adminName={
        profile.full_name || user.email || "Founder"
      }
      documents={
        (documents || []) as AdminCompanyDocument[]
      }
      error={params?.error}
      success={params?.success}
      uploadCompanyDocument={uploadCompanyDocument}
      downloadCompanyDocument={downloadCompanyDocument}
      deleteCompanyDocument={deleteCompanyDocument}
      notifications={notifications}
      userId={user.id}
    />
  );
}