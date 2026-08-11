"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Panel from "@/components/dashboard/Panel";
import StatCard from "@/components/dashboard/StatCard";
import type { FinancialMetrics } from "@/lib/finance/types";
import { reportRegistry } from "@/lib/reports/reportRegistry";
import { createClient } from "@/lib/supabase/client";
import { emitEvent } from "@/lib/events/emitEvent";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/currency/formatCurrency";
import type { Notification } from "@/types/notifications";

type PublishedReport = {
  id: string;
  title: string;
  category: string;
  visibility: string;
  created_at: string;
};

type Props = {
  adminName: string;
  companyId: string;
  companyName: string;
  founderName: string;
  metrics: FinancialMetrics;
  publishedReports: PublishedReport[];
  currency: string;
  notifications: Notification[];
  userId: string;
};

type MessageState =
  | { tone: "success" | "error" | "info"; text: string }
  | null;

type ReadyReport = (typeof reportRegistry)[number];

const ACTION =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35";

export default function AdminReportsClient({
  adminName,
  companyId,
  companyName,
  founderName,
  metrics,
  publishedReports,
  currency,
  notifications,
  userId,
}: Props) {
  const supabase = createClient();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<MessageState>(null);

  const readyReports = useMemo(
    () => reportRegistry.filter((report) => report.status === "ready"),
    []
  );

  const investorPublished = publishedReports.filter(
    (report) => report.visibility === "investors"
  ).length;

  function getReport(reportId: string) {
    return readyReports.find((report) => report.id === reportId) || null;
  }

  function buildPdf(report: ReadyReport) {
    return createPublishableReportPdf({
      title: report.title,
      category: report.category,
      companyName,
      founderName,
      metrics,
      currency,
    });
  }

  async function previewReport(reportId: string) {
  const report = readyReports.find(
    (item) => item.id === reportId
  );

  if (!report) {
    setMessage({
      tone: "error",
      text: "This report is not available.",
    });
    return;
  }

  setPreviewing(reportId);
  setMessage(null);

  try {
    const doc = createPublishableReportPdf({
      title: report.title,
      category: report.category,
      companyName,
      founderName,
      metrics,
      currency,
    });

    const blob = doc.output("blob");
    const previewUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = previewUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => {
      URL.revokeObjectURL(previewUrl);
    }, 60_000);
  } catch (error) {
    setMessage({
      tone: "error",
      text:
        error instanceof Error
          ? error.message
          : "Unable to preview the report.",
    });
  } finally {
    setPreviewing(null);
  }
}

  async function downloadReport(reportId: string) {
    const report = getReport(reportId);
    if (!report) return;

    setDownloading(reportId);
    setMessage(null);

    try {
      const fileName = createFileName(report.title);
      buildPdf(report).save(fileName);

      await emitEvent({
        companyId,
        actorId: userId,
        recipients: [userId],
        type: "report_downloaded",
        title: "Report downloaded",
        message: `${report.title} was generated and downloaded.`,
        actionUrl: "/dashboard/reports",
        severity: "info",
        metadata: {
          reportId: report.id,
          reportTitle: report.title,
          category: report.category,
          visibility: report.defaultVisibility,
          fileName,
          generatedAt: new Date().toISOString(),
          generatedFromLiveData: true,
          currency,
        },
      });

      setMessage({
        tone: "success",
        text: `${report.title} downloaded successfully.`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to download this report.",
      });
    } finally {
      setDownloading(null);
    }
  }

  async function publishReport(reportId: string) {
    const report = getReport(reportId);
    if (!report) return;

    setPublishing(reportId);
    setMessage(null);

    let uploadedPath: string | null = null;

    try {
      const pdfBlob = buildPdf(report).output("blob");
      const fileName = createFileName(report.title);
      const filePath = `${companyId}/reports/${report.id}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-documents")
        .upload(filePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);
      uploadedPath = filePath;

      const { data: document, error: insertError } = await supabase
        .from("company_documents")
        .insert({
          company_id: companyId,
          uploaded_by: userId,
          title: report.title,
          category: report.documentCategory,
          file_path: filePath,
          file_name: fileName,
          file_type: "application/pdf",
          file_size: pdfBlob.size,
          visibility: report.defaultVisibility,
        })
        .select("id")
        .single();

      if (insertError || !document) {
        await supabase.storage.from("company-documents").remove([filePath]);
        uploadedPath = null;
        throw new Error(insertError?.message || "Unable to save the report record.");
      }

      await emitEvent({
        companyId,
        actorId: userId,
        type:
          report.defaultVisibility === "investors"
            ? "investor_report_published"
            : "report_published",
        title:
          report.defaultVisibility === "investors"
            ? "Investor report published"
            : "Report published",
        message:
          report.defaultVisibility === "investors"
            ? `${report.title} was published to the investor document centre.`
            : `${report.title} was published to company documents.`,
        actionUrl: "/dashboard/reports",
        referenceType: "document",
        referenceId: document.id,
        severity: "success",
        metadata: {
          documentId: document.id,
          reportId: report.id,
          reportTitle: report.title,
          category: report.category,
          visibility: report.defaultVisibility,
          fileName,
          filePath,
          fileSize: pdfBlob.size,
          generatedAt: new Date().toISOString(),
          generatedFromLiveData: true,
          currency,
        },
        notifications: [
          {
            recipientIds: [userId],
            title: "Report published",
            message: `${report.title} was published successfully.`,
            actionUrl: "/dashboard/reports",
            metadata: { audience: "admin", documentId: document.id },
          },
          ...(report.defaultVisibility === "investors"
            ? [
                {
                  roles: ["investor" as const],
                  title: "New investor report available",
                  message: `${report.title} is now available in your documents.`,
                  actionUrl: "/investor/documents",
                  metadata: {
                    audience: "investor",
                    documentId: document.id,
                  },
                  excludeActor: true,
                },
              ]
            : []),
        ],
      });

      setMessage({
        tone: "success",
        text: `${report.title} published successfully.`,
      });

      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from("company-documents")
          .remove([uploadedPath]);
      }

      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to publish this report.",
      });
    } finally {
      setPublishing(null);
    }
  }

  return (
    <AdminShell
      title="Reports"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <div className="space-y-6 text-[color:var(--text-primary)]">
        <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">
                Live financial intelligence
              </p>
            </div>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em]">
              Reports Centre
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[color:var(--text-tertiary)]">
              Preview, download and publish investor-grade reports generated
              from live Helix financial data.
            </p>
          </div>

          <Link
            href="/dashboard/documents"
            className={`${ACTION} border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)]`}
          >
            Open Documents
          </Link>
        </header>

        {message && <MessageBanner message={message} />}

        <div className="grid gap-4 xl:grid-cols-4">
          <StatCard
            label="Operational Reports"
            value={readyReports.length}
            note="Preview, download and publish"
          />
          <StatCard
            label="Published Reports"
            value={publishedReports.length}
            note={`${investorPublished} visible to investors`}
          />
          <StatCard
            label="Health Score"
            value={`${metrics.businessHealthScore}/100`}
            note="Live finance engine"
          />
          <StatCard
            label="Valuation"
            value={money(metrics.companyValuation, currency)}
            note="Estimated company value"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface-soft)]">
          <div className="flex flex-col justify-between gap-5 border-b border-[color:var(--border)] px-6 py-6 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold">Executive Snapshot</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                Live values used by the report generator.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MetricChip label="Revenue" value={money(metrics.revenue, currency)} />
              <MetricChip label="Net Profit" value={money(metrics.netProfit, currency)} />
              <MetricChip label="Cash" value={money(metrics.cashBalance, currency)} />
            </div>
          </div>
          <div className="grid gap-px bg-[color:var(--surface-muted)] sm:grid-cols-2 xl:grid-cols-4">
            <Snapshot label="Gross Profit" value={money(metrics.grossProfit, currency)} />
            <Snapshot label="Operating Expenses" value={money(metrics.expenses, currency)} />
            <Snapshot label="Inventory Value" value={money(metrics.inventoryValue, currency)} />
            <Snapshot label="COGS" value={money(metrics.cogs, currency)} />
          </div>
        </section>

        <Panel
          title="Operational Reports"
          subtitle="Every report below is live and fully functional"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {readyReports.map((report) => {
              const busy =
                previewing === report.id ||
                downloading === report.id ||
                publishing === report.id;

              return (
                <article
                  key={report.id}
                  className="rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface-soft)] p-5 transition hover:border-[color:var(--border-brand)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">
                        {report.category}
                      </p>
                      <h3 className="mt-2 text-base font-semibold">{report.title}</h3>
                    </div>
                    <span className="rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--success)]">
                      Operational
                    </span>
                  </div>

                  <p className="mt-3 min-h-[48px] text-sm leading-6 text-[color:var(--text-tertiary)]">
                    {report.description}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Mini label="Visibility" value={formatLabel(report.defaultVisibility)} />
                    <Mini label="Source" value="Live finance engine" />
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => previewReport(report.id)}
                      disabled={busy}
                      className={`${ACTION} border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]`}
                    >
                      {previewing === report.id ? "Opening..." : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadReport(report.id)}
                      disabled={busy}
                      className={`${ACTION} border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] hover:bg-[color:var(--primary-soft)]`}
                    >
                      {downloading === report.id ? "Preparing..." : "Download"}
                    </button>
                    <button
                      type="button"
                      onClick={() => publishReport(report.id)}
                      disabled={busy}
                      className={`${ACTION} border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)] hover:bg-[color:var(--success-soft)]`}
                    >
                      {publishing === report.id ? "Publishing..." : "Publish"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Published Reports"
          subtitle="Saved securely in the company data room"
        >
          {publishedReports.length ? (
            <div className="overflow-hidden rounded-xl border border-[color:var(--border)]">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3">Report</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Visibility</th>
                    <th className="px-4 py-3">Published</th>
                    <th className="px-4 py-3 text-right">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedReports.map((report) => (
                    <tr key={report.id} className="border-t border-[color:var(--border)]">
                      <td className="px-4 py-4 font-medium">{report.title}</td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">
                        {formatLabel(report.category)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[color:var(--primary-soft)] px-3 py-1 text-xs text-[color:var(--primary)]">
                          {formatLabel(report.visibility)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">
                        {new Date(report.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href="/dashboard/documents"
                          className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-xs text-[color:var(--primary)]"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center text-sm text-[color:var(--text-tertiary)]">
              Publish a report above to save it into company documents.
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

function MessageBanner({ message }: { message: Exclude<MessageState, null> }) {
  const style = {
    success: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    error: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    info: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
  }[message.tone];

  return <div className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{message.text}</div>;
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--primary)]">{label}</p>
      <p className="mt-1 text-xs font-semibold text-[color:var(--primary)]">{value}</p>
    </div>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[color:var(--surface)] px-6 py-5">
      <p className="text-[9px] uppercase tracking-[0.13em] text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.11em] text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xs font-medium text-[color:var(--text-secondary)]">{value}</p>
    </div>
  );
}

function createFileName(title: string) {
  const safe = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safe}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function money(value: number, currency: string) {
  return formatCurrency(value, currency);
}

function createPublishableReportPdf({
  title,
  category,
  companyName,
  founderName,
  metrics,
  currency,
}: {
  title: string;
  category: string;
  companyName: string;
  founderName: string;
  metrics: FinancialMetrics;
  currency: string;
}) {
  const doc = new jsPDF();

  doc.setFillColor(3, 11, 13);
  doc.rect(0, 0, 210, 34, "F");
  doc.setFontSize(10);
  doc.setTextColor(103, 232, 249);
  doc.text("HELIX FINANCIAL OS", 14, 15);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 27);

  doc.setFontSize(10);
  doc.setTextColor(65, 65, 65);
  doc.text(`Company: ${companyName}`, 14, 48);
  doc.text(`Founder: ${founderName}`, 14, 56);
  doc.text(`Category: ${category}`, 14, 64);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 72);

  autoTable(doc, {
    startY: 84,
    head: [["Financial Metric", "Live Value"]],
    body: [
      ["Revenue", money(metrics.revenue, currency)],
      ["Cost of Goods Sold", money(metrics.cogs, currency)],
      ["Gross Profit", money(metrics.grossProfit, currency)],
      ["Operating Expenses", money(metrics.expenses, currency)],
      ["Net Profit", money(metrics.netProfit, currency)],
      ["Cash Balance", money(metrics.cashBalance, currency)],
      ["Inventory Value", money(metrics.inventoryValue, currency)],
      ["Estimated Company Valuation", money(metrics.companyValuation, currency)],
      ["Business Health Score", `${metrics.businessHealthScore}/100`],
    ],
    headStyles: {
      fillColor: [4, 58, 65],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [244, 249, 250] },
    margin: { left: 14, right: 14 },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 150;

  doc.setFontSize(13);
  doc.setTextColor(10, 10, 10);
  doc.text("Executive Summary", 14, finalY + 16);
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(
    doc.splitTextToSize(
      `This report was generated from live Helix company data. Revenue is ${money(
        metrics.revenue,
        currency
      )}, net profit is ${money(
        metrics.netProfit,
        currency
      )}, estimated valuation is ${money(
        metrics.companyValuation,
        currency
      )}, and business health is ${metrics.businessHealthScore}/100.`,
      180
    ),
    14,
    finalY + 26
  );

  return doc;
}