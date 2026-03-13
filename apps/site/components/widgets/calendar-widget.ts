export const CALENDAR_WIDGET_REPO_PATH = "/components/widgets/calendar-widget.ts";

export type CalendarWidgetExecutionInput = {
  widgetId: string;
  pageId?: string;
  blockId?: string;
  payload?: Record<string, unknown>;
};

export type CalendarWidgetExecutionResult = {
  status: "ok";
  event: string;
  slot: string;
  trace: {
    widgetId: string;
    pageId: string | null;
    blockId: string | null;
  };
};

function normalizeSlot(raw: unknown): string {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
}

export function executeCalendarWidget(input: CalendarWidgetExecutionInput): CalendarWidgetExecutionResult {
  const preferredSlot = normalizeSlot(input.payload?.preferredSlot);
  return {
    status: "ok",
    event: "calendar_slot_reserved",
    slot: preferredSlot,
    trace: {
      widgetId: input.widgetId,
      pageId: typeof input.pageId === "string" ? input.pageId : null,
      blockId: typeof input.blockId === "string" ? input.blockId : null
    }
  };
}
