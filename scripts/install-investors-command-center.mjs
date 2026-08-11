#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

function backup(file) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) {
    const backupPath = `${full}.bak-investors-command-center`;
    if (!fs.existsSync(backupPath)) fs.copyFileSync(full, backupPath);
  }
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Could not find patch marker: ${label}`);
  }
  return content.replace(search, replacement);
}

const componentFile = "components/investors/InvestorsCommandCenter.tsx";
const pageFile = "app/dashboard/investors/page.tsx";
const clientFile = "app/dashboard/investors/AdminInvestorsClient.tsx";

const componentContent = fs.readFileSync(
  new URL("../components/investors/InvestorsCommandCenter.tsx", import.meta.url),
  "utf8"
);

backup(componentFile);
backup(pageFile);
backup(clientFile);

write(componentFile, componentContent);

let page = read(pageFile);

if (!page.includes("@/components/investors/InvestorsCommandCenter")) {
  page = page.replace(
    'import AdminInvestorsClient from "./AdminInvestorsClient";',
    `import AdminInvestorsClient from "./AdminInvestorsClient";
import type {
  CompanyCapTableSummary,
  CompanyInvestorOverview,
  InvestorsSqlHealth,
} from "@/components/investors/InvestorsCommandCenter";`
  );
}

if (!page.includes("const investorsSqlHealthResult")) {
  const rpcBlock = `
  const rpcClient = supabase as any;
  const now = new Date().toISOString();

  const [
    investorsSqlHealthResult,
    companyInvestorOverviewResult,
    companyCapTableSummaryResult,
  ] = await Promise.all([
    rpcClient.rpc("get_investors_sql_100_percent_health"),
    rpcClient.rpc("api_get_company_investor_overview", {
      p_company_id: profile.company_id,
      p_as_of_at: now,
      p_use_materialized: true,
    }),
    rpcClient.rpc("api_get_company_cap_table_summary", {
      p_company_id: profile.company_id,
      p_as_of_at: now,
      p_use_materialized: true,
    }),
  ]);

  const investorsSqlHealth =
    (investorsSqlHealthResult.data as InvestorsSqlHealth | null) || null;

  const companyInvestorOverview =
    (companyInvestorOverviewResult.data as CompanyInvestorOverview | null) ||
    null;

  const companyCapTableSummary =
    (companyCapTableSummaryResult.data as CompanyCapTableSummary | null) ||
    null;

`;

  const marker = /\n(\s*)return\s*\(\s*\n(\s*)<AdminInvestorsClient/;
  if (!marker.test(page)) {
    throw new Error("Could not find the AdminInvestorsClient return block in page.tsx.");
  }
  page = page.replace(marker, `\n${rpcBlock}$1return (\n$2<AdminInvestorsClient`);
}

if (!page.includes("investorsSqlHealth={investorsSqlHealth}")) {
  page = page.replace(
    "<AdminInvestorsClient",
    `<AdminInvestorsClient
      investorsSqlHealth={investorsSqlHealth}
      companyInvestorOverview={companyInvestorOverview}
      companyCapTableSummary={companyCapTableSummary}`
  );
}

write(pageFile, page);

let client = read(clientFile);

if (!client.includes("@/components/investors/InvestorsCommandCenter")) {
  client = client.replace(
    'import CorporateActionsWorkspace, {\n  type CorporateActionsWorkspaceProps,\n} from "./CorporateActionsWorkspace";',
    `import CorporateActionsWorkspace, {
  type CorporateActionsWorkspaceProps,
} from "./CorporateActionsWorkspace";
import InvestorsCommandCenter, {
  type CompanyCapTableSummary,
  type CompanyInvestorOverview,
  type InvestorsSqlHealth,
} from "@/components/investors/InvestorsCommandCenter";`
  );
}

if (!client.includes("investorsSqlHealth: InvestorsSqlHealth | null;")) {
  client = client.replace(
    "  userId: string;\n  corporateActions: CorporateActionsWorkspaceProps;",
    `  userId: string;
  investorsSqlHealth: InvestorsSqlHealth | null;
  companyInvestorOverview: CompanyInvestorOverview | null;
  companyCapTableSummary: CompanyCapTableSummary | null;
  corporateActions: CorporateActionsWorkspaceProps;`
  );
}

if (!client.includes("investorsSqlHealth,")) {
  client = client.replace(
    "  notifications,\n  userId,\n  corporateActions,",
    `  notifications,
  userId,
  investorsSqlHealth,
  companyInvestorOverview,
  companyCapTableSummary,
  corporateActions,`
  );
}

if (!client.includes("<InvestorsCommandCenter")) {
  client = client.replace(
    '        <div className="grid gap-4 xl:grid-cols-4">',
    `        <InvestorsCommandCenter
          health={investorsSqlHealth}
          investorOverview={companyInvestorOverview}
          capTableSummary={companyCapTableSummary}
          currency={currency}
        />

        <div className="grid gap-4 xl:grid-cols-4">`
  );
}

write(clientFile, client);

console.log("✅ Investors Command Center installed.");
console.log("Backups created with .bak-investors-command-center if they did not already exist.");
console.log("Now run: npm run dev");
