import {
  CALENDAR_WIDGET_REPO_PATH,
  executeCalendarWidget,
  type CalendarWidgetExecutionResult
} from "../../../../../../components/widgets/calendar-widget";
import {
  REPORT_DOWNLOAD_WIDGET_REPO_PATH,
  executeReportDownloadWidget,
  type ReportDownloadWidgetExecutionResult
} from "../../../../../../components/widgets/report-download-widget";

export type RepoWidgetRuntimeResult = CalendarWidgetExecutionResult | ReportDownloadWidgetExecutionResult;

export type RepoWidgetAdapter = {
  repoPath: string;
  displayName: string;
  widgetType: "booking_popup" | "download_gate";
  surface: "modal" | "inline";
  execute: (params: {
    widgetId: string;
    pageId?: string;
    blockId?: string;
    payload?: Record<string, unknown>;
  }) => RepoWidgetRuntimeResult;
};

const REPO_WIDGET_ADAPTERS: RepoWidgetAdapter[] = [
  {
    repoPath: CALENDAR_WIDGET_REPO_PATH,
    displayName: "Calendar Booking Widget",
    widgetType: "booking_popup",
    surface: "modal",
    execute: (params) =>
      executeCalendarWidget({
        widgetId: params.widgetId,
        pageId: params.pageId,
        blockId: params.blockId,
        payload: params.payload
      })
  },
  {
    repoPath: REPORT_DOWNLOAD_WIDGET_REPO_PATH,
    displayName: "Report Download Widget",
    widgetType: "download_gate",
    surface: "inline",
    execute: (params) =>
      executeReportDownloadWidget({
        widgetId: params.widgetId,
        pageId: params.pageId,
        payload: params.payload
      })
  }
];

export function listRepoWidgetAdapters(): RepoWidgetAdapter[] {
  return REPO_WIDGET_ADAPTERS;
}

export function resolveRepoWidgetAdapter(repoPath: string): RepoWidgetAdapter | null {
  const normalized = repoPath.trim();
  return REPO_WIDGET_ADAPTERS.find((entry) => entry.repoPath === normalized) ?? null;
}

export function isRepoWidgetPathAllowed(repoPath: string): boolean {
  return resolveRepoWidgetAdapter(repoPath) !== null;
}
