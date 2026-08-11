"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import Panel from "@/components/dashboard/Panel";
import StatCard from "@/components/dashboard/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type {
  AdminCompanyDocument,
  DocumentDownloadResult,
} from "./page";
import type { Notification } from "@/types/notifications";

type Props = {
  adminName: string;
  documents: AdminCompanyDocument[];
  error?: string;
  success?: string;
  uploadCompanyDocument: (formData: FormData) => void;
  downloadCompanyDocument: (
    formData: FormData
  ) => Promise<DocumentDownloadResult>;
  deleteCompanyDocument: (formData: FormData) => void;
  notifications: Notification[];
  userId: string;
};

const categories = [
  { value: "financial", label: "Financial Statements" },
  { value: "legal", label: "Legal Documents" },
  { value: "tax", label: "Tax Documents" },
  { value: "board", label: "Board Documents" },
  { value: "cap_table", label: "Cap Table" },
  { value: "other", label: "Other Documents" },
];

export default function AdminDocumentsClient({
  adminName,
  documents,
  error,
  success,
  uploadCompanyDocument,
  downloadCompanyDocument,
  deleteCompanyDocument,
  notifications,
  userId,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesSearch =
        document.title.toLowerCase().includes(query) ||
        document.file_name.toLowerCase().includes(query) ||
        document.category.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        document.category === categoryFilter;

      const matchesVisibility =
        visibilityFilter === "all" ||
        document.visibility === visibilityFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesVisibility
      );
    });
  }, [
    documents,
    search,
    categoryFilter,
    visibilityFilter,
  ]);

  const investorVisible = documents.filter(
    (document) => document.visibility === "investors"
  );

  const adminOnly = documents.filter(
    (document) => document.visibility === "admin_only"
  );

  const financialReports = documents.filter(
    (document) => document.category === "financial"
  );

  return (
    <AdminShell
      title="Documents"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <div className="space-y-6 text-[color:var(--text-primary)]">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--primary)]">
            Company Data Room
          </p>

          <div className="mt-1 text-xl font-semibold">
            Secure Documents
          </div>

          <p className="mt-1 max-w-3xl text-xs text-[color:var(--text-tertiary)]">
            Upload, manage and control access to financial
            reports, legal files, tax documents, board updates
            and investor-visible company records.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-sm text-[color:var(--primary)]">
            {success}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Documents"
            value={documents.length}
            note="All company files"
          />

          <StatCard
            label="Investor Visible"
            value={investorVisible.length}
            note="Shown in investor portal"
          />

          <StatCard
            label="Admin Only"
            value={adminOnly.length}
            note="Private founder files"
          />

          <StatCard
            label="Financial Reports"
            value={financialReports.length}
            note="Generated or uploaded"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <Panel
            title="Upload Document"
            subtitle="Add files to the secure company data room"
          >
            <form
              action={uploadCompanyDocument}
              className="space-y-4"
            >
              <Field
                name="title"
                label="Document title"
                placeholder="Q2 Investor Update"
                required
              />

              <label className="block text-xs text-[color:var(--text-secondary)]">
                Category
                <select
                  name="category"
                  required
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
                >
                  <option value="">Select category</option>

                  {categories.map((category) => (
                    <option
                      key={category.value}
                      value={category.value}
                    >
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-[color:var(--text-secondary)]">
                Visibility
                <select
                  name="visibility"
                  defaultValue="admin_only"
                  required
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
                >
                  <option value="admin_only">
                    Admin only
                  </option>

                  <option value="investors">
                    Visible to investors
                  </option>
                </select>
              </label>

              <label className="block text-xs text-[color:var(--text-secondary)]">
                File
                <input
                  name="file"
                  type="file"
                  required
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] file:mr-4 file:rounded-lg file:border-0 file:bg-[color:var(--primary-soft)] file:px-3 file:py-2 file:text-[color:var(--primary)]"
                />
              </label>

              <button className="w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-sm font-medium text-[color:var(--primary)]">
                Upload Secure Document
              </button>
            </form>
          </Panel>

          <Panel
            title="Document Library"
            subtitle="Search, filter, download and manage company documents"
          >
            <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_220px_220px]">
              <input
                placeholder="Search title, file name or category..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
              />

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
              >
                <option value="all">
                  All categories
                </option>

                {categories.map((category) => (
                  <option
                    key={category.value}
                    value={category.value}
                  >
                    {category.label}
                  </option>
                ))}
              </select>

              <select
                value={visibilityFilter}
                onChange={(event) =>
                  setVisibilityFilter(event.target.value)
                }
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
              >
                <option value="all">
                  All visibility
                </option>

                <option value="admin_only">
                  Admin only
                </option>

                <option value="investors">
                  Investors
                </option>
              </select>
            </div>

            {filteredDocuments.length ? (
              <div className="space-y-3">
                {filteredDocuments.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    downloadCompanyDocument={
                      downloadCompanyDocument
                    }
                    onDelete={() =>
                      setDeleteId(document.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--text-tertiary)]">
                No documents found.
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {categories.map((category) => (
            <DocumentCategoryPanel
              key={category.value}
              title={category.label}
              category={category.value}
              documents={documents}
              downloadCompanyDocument={
                downloadCompanyDocument
              }
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>

        <ConfirmDialog
          open={Boolean(deleteId)}
          title="Delete Document"
          description="This will remove the document metadata and delete the file from secure storage."
          confirmText="Delete Document"
          cancelText="Cancel"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            if (!deleteId) return;

            const formData = new FormData();
            formData.append("document_id", deleteId);

            deleteCompanyDocument(formData);
            setDeleteId(null);
          }}
        />
      </div>
    </AdminShell>
  );
}

function DocumentCategoryPanel({
  title,
  category,
  documents,
  downloadCompanyDocument,
  onDelete,
}: {
  title: string;
  category: string;
  documents: AdminCompanyDocument[];
  downloadCompanyDocument: (
    formData: FormData
  ) => Promise<DocumentDownloadResult>;
  onDelete: (id: string) => void;
}) {
  const items = documents.filter(
    (document) => document.category === category
  );

  return (
    <Panel
      title={title}
      subtitle={`${items.length} document${
        items.length === 1 ? "" : "s"
      }`}
    >
      {items.length ? (
        <div className="space-y-3">
          {items.slice(0, 4).map((document) => (
            <MiniDocument
              key={document.id}
              document={document}
              downloadCompanyDocument={
                downloadCompanyDocument
              }
              onDelete={onDelete}
            />
          ))}

          {items.length > 4 && (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              + {items.length - 4} more in the full
              document library
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 text-sm text-[color:var(--text-tertiary)]">
          No documents.
        </div>
      )}
    </Panel>
  );
}

function DocumentRow({
  document,
  downloadCompanyDocument,
  onDelete,
}: {
  document: AdminCompanyDocument;
  downloadCompanyDocument: (
    formData: FormData
  ) => Promise<DocumentDownloadResult>;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">
            {document.title}
          </p>

          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
            {document.file_name}
          </p>

          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
            {labelForCategory(document.category)} · Uploaded{" "}
            {new Date(
              document.created_at
            ).toLocaleDateString()}
            {document.file_size
              ? ` · ${formatFileSize(
                  document.file_size
                )}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VisibilityBadge
            visibility={document.visibility}
          />

          <DownloadButton
            document={document}
            downloadCompanyDocument={
              downloadCompanyDocument
            }
            className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-2 text-xs font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
          />

          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-2 text-xs font-medium text-[color:var(--danger)]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniDocument({
  document,
  downloadCompanyDocument,
  onDelete,
}: {
  document: AdminCompanyDocument;
  downloadCompanyDocument: (
    formData: FormData
  ) => Promise<DocumentDownloadResult>;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
      <p className="text-sm font-medium text-[color:var(--text-primary)]">
        {document.title}
      </p>

      <p className="mt-1 truncate text-xs text-[color:var(--text-tertiary)]">
        {document.file_name}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <VisibilityBadge
          visibility={document.visibility}
        />

        <div className="flex gap-2">
          <DownloadButton
            document={document}
            downloadCompanyDocument={
              downloadCompanyDocument
            }
            className="text-xs text-[color:var(--primary)] transition hover:text-[color:var(--primary)]"
          />

          <button
            type="button"
            onClick={() => onDelete(document.id)}
            className="text-xs text-[color:var(--danger)]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DownloadButton({
  document,
  downloadCompanyDocument,
  className,
}: {
  document: AdminCompanyDocument;
  downloadCompanyDocument: (
    formData: FormData
  ) => Promise<DocumentDownloadResult>;
  className: string;
}) {
  const [isDownloading, setIsDownloading] =
    useState(false);

  async function handleDownload() {
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      const formData = new FormData();

      formData.append("document_id", document.id);

      const result =
        await downloadCompanyDocument(formData);

      if (!result.url) {
        window.alert(
          result.error ||
            "Unable to download this document."
        );
        return;
      }

      const downloadLink =
        window.document.createElement("a");

      downloadLink.href = result.url;
      downloadLink.download = document.file_name;
      downloadLink.rel = "noopener noreferrer";
      downloadLink.style.display = "none";

      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (downloadError) {
      console.error(
        "Document download failed:",
        downloadError
      );

      window.alert(
        "Unable to download this document."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {isDownloading ? "Downloading..." : "Download"}
    </button>
  );
}

function VisibilityBadge({
  visibility,
}: {
  visibility: string;
}) {
  if (visibility === "investors") {
    return (
      <span className="rounded-full bg-[color:var(--primary-soft)] px-3 py-1 text-xs text-[color:var(--primary)]">
        Investors
      </span>
    );
  }

  return (
    <span className="rounded-full bg-[color:var(--surface-soft)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
      Admin only
    </span>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}

      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function labelForCategory(category: string) {
  return (
    categories.find(
      (item) => item.value === category
    )?.label || category.replaceAll("_", " ")
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(
    1
  )} MB`;
}