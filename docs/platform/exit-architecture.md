# Exit Architecture

## Core Model

CTA visuals do not own business logic.

- CTA: visible trigger in shell/block/widget
- ActionBinding: click behavior contract
- WidgetDefinition: reusable interactive surface
- ExitDefinition: backend/business integration contract

## Why This Matters

- Operators can change behavior without code edits
- Block components stay pure UI
- Backend orchestration stays governed and replaceable

## Action Types

- `link_url`
- `scroll_to_section`
- `open_modal`
- `open_drawer`
- `open_widget`
- `submit_form`
- `download_asset`
- `external_booking`
- `workflow`

## ExitDefinition

Each exit defines:

- `id`
- `state` (`active`/`inactive`)
- `eventName`
- `payloadSchema`
- `frontendAdapterType`
- `backendAdapterType`
- `workflowTarget`
- fallback/success/failure behavior
- analytics mapping
- policy guardrails

## Book Appointment Reference

Preferred chain:

1. Hero CTA -> `ActionBinding(type=open_widget, widgetId=booking_popup_primary)`
2. `WidgetDefinition(booking_popup_primary)`
3. Widget binds to `ExitDefinition(book_appointment_primary)`
4. Frontend emits governed event via Rudder
5. Backend adapter calls n8n workflow target

## Activation / Deactivation

- Exit can be toggled inactive without block code changes
- Action can be remapped to another exit at config level
- Widget can be swapped while keeping CTA label stable

## Runtime

- Frontend adapter resolves immediate UX action
- Backend adapter resolves workflow/system execution
- n8n remains orchestration center
- Rudder remains event stream layer
