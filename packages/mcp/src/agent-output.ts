const SENSITIVE_KEYS = new Set([
  "accesstoken",
  "apikey",
  "archivedbyuserid",
  "authorization",
  "ciphertext",
  "clientsecret",
  "cookie",
  "createdbyuserid",
  "databaseurl",
  "databasepassword",
  "databaseusername",
  "databasehost",
  "databaseport",
  "database",
  "databaseuser",
  "databasepass",
  "databaseuri",
  "databaseconnectionstring",
  "databaseconnectionurl",
  "dataBase64".toLowerCase(),
  "deliverypayload",
  "eventtoken",
  "eventtokenhash",
  "headers",
  "internalaccess",
  "ipaddress",
  "membershipid",
  "nonce",
  "password",
  "privatekey",
  "publiclinkkey",
  "publishedbyuserid",
  "refreshtoken",
  "requestid",
  "secret",
  "signingsecret",
  "token",
  "updatedbyuserid",
  "uploadedbyuserid",
  "userid",
  "visitorhash",
]);

export function sanitizeAgentOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAgentOutput);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, child]) => [key, sanitizeAgentOutput(child)]),
  );
}

export function formatToolText(toolName: string, value: unknown) {
  const result = isRecord(value) ? value : { value };
  if (isRecord(result.error)) return formatError(result.error);
  switch (toolName) {
    case "handout_get_capabilities":
      return `Handout is connected. Site schema v${readPath(result, "siteContent", "schemaVersion")}; ${arrayLength(readPath(result, "siteContent", "schemaDiscovery", "topLevelBlocks"))} top-level blocks are available. Use handout_get_block_schemas before authoring and handout_get_workspace_context before mutating workspace data.`;
    case "handout_get_workspace_context": {
      const workspace = record(result.workspace);
      const automationCount = arrayLength(result.automations);
      return `Active workspace: ${text(workspace.name, "Unknown")} (${text(workspace.plan, "unknown")} plan, ${text(workspace.role, "unknown")} role).${result.automations ? ` ${automationCount} automation${plural(automationCount)} returned.` : ""}`;
    }
    case "handout_list_sites": {
      const sites = array(result.sites);
      const total = typeof result.totalMatched === "number" ? result.totalMatched : sites.length;
      return [`${sites.length} of ${total} matching site${plural(total)} returned.${result.nextCursor ? " More are available via nextCursor." : ""}`, ...sites.slice(0, 10).map((site) => formatSiteLine(record(site)))].join("\n");
    }
    case "handout_get_site": {
      const site = record(result.site);
      const sections = array(result.included).map(String);
      return `${text(site.name, "Site")} is ${text(site.status, "unknown")} and ${text(site.visibility, "unknown")}. ID: ${text(site.id)}.${result.draftRevision ? ` Draft revision: ${result.draftRevision}.` : ""}${sections.length ? ` Included: ${sections.join(", ")}.` : ""}`;
    }
    case "handout_create_site": {
      const site = record(result.site);
      return `Created private draft “${text(site.name, "Untitled")}”. Site ID: ${text(site.id)}.${result.editorUrl ? ` Editor: ${result.editorUrl}` : ""}`;
    }
    case "handout_duplicate_site": {
      const site = record(result.site);
      return `Created duplicate draft “${text(site.name, "Untitled")}”. Site ID: ${text(site.id)}.${result.editorUrl ? ` Editor: ${result.editorUrl}` : ""}`;
    }
    case "handout_edit_site": {
      const site = record(result.site);
      return `Updated “${text(site.name, "site")}”.${result.draftRevision ? ` Draft revision is now ${result.draftRevision}.` : ""}${Array.isArray(result.appliedOperations) ? ` Applied ${result.appliedOperations.length} operation${plural(result.appliedOperations.length)}: ${result.appliedOperations.join(", ")}.` : ""}`;
    }
    case "handout_validate_site": {
      const issues = array(result.issues);
      if (result.valid === true) return "The site is valid and ready for publishing checks. No blocking issues were found.";
      return [`The site has ${issues.length} validation issue${plural(issues.length)}.`, ...issues.slice(0, 10).map((issue) => formatIssue(record(issue)))].join("\n");
    }
    case "handout_set_site_access": {
      const site = record(result.site);
      return `Site access is now ${text(site.visibility, "unknown")}.${site.visibility === "team" ? " Published pages can be shared with the team." : " Team sharing is disabled."}`;
    }
    case "handout_publish_site": {
      const site = record(result.site);
      return `Published “${text(site.name, "site")}”.${result.siteUrl ? ` Public URL: ${result.siteUrl}` : ""}`;
    }
    case "handout_unpublish_site":
      return "The site is unpublished. Its draft and version history remain available.";
    case "handout_restore_site_version":
      return `Restored version ${text(record(result.version).versionNumber, "unknown")} into the draft. It was not published automatically.${result.draftRevision ? ` Draft revision: ${result.draftRevision}.` : ""}`;
    case "handout_set_site_lifecycle": {
      const site = record(result.site);
      return `Site lifecycle changed to ${text(site.status, "unknown")}.`;
    }
    case "handout_upsert_variants": {
      const variants = array(result.variants);
      if (result.preview === true) return `Variant preview is valid for ${variants.length} recipient${plural(variants.length)}. No variants were changed.`;
      return `Created or updated ${variants.length} recipient variant${plural(variants.length)}.`;
    }
    case "handout_list_assets": {
      const assets = array(result.assets);
      return `${assets.length} workspace asset${plural(assets.length)} returned.${assets.length ? `\n${assets.slice(0, 10).map((asset) => { const item = record(asset); return `- ${text(item.fileName, "Asset")} (${text(item.purpose, "image")}, ${text(item.width)}×${text(item.height)}) — ${text(item.id)}`; }).join("\n")}` : ""}`;
    }
    case "handout_import_asset": {
      const asset = record(result.asset);
      return `Imported ${text(asset.fileName, "asset")} (${text(asset.width)}×${text(asset.height)}). Asset ID: ${text(asset.id)}. URL: ${text(asset.url)}`;
    }
    case "handout_get_tracking_summary": {
      const metrics = record(result.metrics);
      const partial = record(result.coverage).isPartial === true;
      return `Engagement summary: ${text(metrics.sessionCount, 0)} sessions, ${text(metrics.siteVisits, 0)} visits, ${text(metrics.buttonClicks, 0)} button clicks, ${text(metrics.linkClicks, 0)} link clicks, and ${text(metrics.tabSwitches, 0)} tab switches.${partial ? " More rows are available; use the returned cursors for complete coverage." : " Coverage is complete for this query."}`;
    }
    case "handout_query_tracking": {
      const view = text(result.view, "records");
      const records = view === "events" ? array(result.events) : array(result.sessions);
      return `${records.length} tracking ${view} returned.${result.nextCursor ? " More rows are available via nextCursor." : " No additional page is available."}`;
    }
    case "handout_manage_automation": {
      if (result.valid === true && result.preview === true) return "Automation configuration is valid. No automation was changed.";
      const automation = record(result.automation);
      if (result.deliveryId) return `Automation test or retry was queued. Delivery ID: ${result.deliveryId}.`;
      return `Automation “${text(automation.name, "automation")}” is ${text(automation.state, "updated")}. ID: ${text(automation.id)}.${result.secretWithheld === true ? " Its signing secret was intentionally withheld from the agent response; retrieve it in Handout settings." : ""}`;
    }
    case "handout_delete": {
      if (result.deleted === true) return `Deleted ${text(result.targetType, "target")} “${text(result.targetName, text(result.targetId))}”.`;
      return `Deletion preview for ${text(result.targetType, "target")} “${text(result.targetName, text(result.targetId))}”. Nothing was deleted.${Number(result.referenceCount) > 0 ? ` ${result.referenceCount} reference${plural(Number(result.referenceCount))} must be removed first.` : " Set confirm=true and provide the exact target name to proceed."}`;
    }
    default:
      return summarizeUnknown(result);
  }
}

function formatError(error: Record<string, unknown>) {
  const issues = array(error.issues);
  return [`Handout could not complete the request: ${text(error.message, "Unknown error")}${error.code ? ` (${error.code})` : ""}.`, ...issues.slice(0, 8).map((issue) => formatIssue(record(issue)))].join("\n");
}

function formatIssue(issue: Record<string, unknown>) {
  const path = Array.isArray(issue.path) ? issue.path.join(".") : "request";
  return `- ${path}: ${text(issue.message, "Invalid value")}`;
}

function formatSiteLine(site: Record<string, unknown>) {
  return `- ${text(site.name, "Untitled")} — ${text(site.status, "unknown")}, ${text(site.visibility, "unknown")} — ${text(site.id)}`;
}

function summarizeUnknown(result: Record<string, unknown>) {
  const keys = Object.keys(result);
  return keys.length ? `Handout completed the request. Returned: ${keys.slice(0, 12).join(", ")}.` : "Handout completed the request.";
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase());
}

function readPath(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) current = isRecord(current) ? current[key] : undefined;
  return current;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function arrayLength(value: unknown) {
  return array(value).length;
}

function text(value: unknown, fallback: string | number = "unknown") {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : String(fallback);
}

function plural(count: number) {
  return count === 1 ? "" : "s";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
