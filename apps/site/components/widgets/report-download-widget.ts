export const REPORT_DOWNLOAD_WIDGET_REPO_PATH = "/components/widgets/report-download-widget.ts";

export type ReportDownloadWidgetExecutionInput = {
  widgetId: string;
  pageId?: string;
  payload?: Record<string, unknown>;
};

export type ReportDownloadWidgetExecutionResult = {
  status: "ok";
  event: string;
  assetId: string;
  trace: {
    widgetId: string;
    pageId: string | null;
  };
};

function normalizeAssetId(raw: unknown): string {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return "default-report";
}

export function executeReportDownloadWidget(
  input: ReportDownloadWidgetExecutionInput
): ReportDownloadWidgetExecutionResult {
  return {
    status: "ok",
    event: "report_download_requested",
    assetId: normalizeAssetId(input.payload?.assetId),
    trace: {
      widgetId: input.widgetId,
      pageId: typeof input.pageId === "string" ? input.pageId : null
    }
  };
}
