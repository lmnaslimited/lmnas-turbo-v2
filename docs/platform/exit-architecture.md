# Exit Architecture

## Definition

An exit is a governed business interaction point triggered from website UI and executed through adapter/runtime contracts.

## Core Entities

- `ExitDefinition`
- `ExitBinding`
- `ExitState`
- `ExitPayloadSchema`
- `ExitPolicy`
- `ExitExecutionTarget`
- `ExitAuditLog`

## Runtime Rule

Blocks/nav/footer do not contain business logic. They only reference `exitId`.

## Adapter Pattern

- Frontend adapter types: `redirect`, `modal`, `form`, `chat_drawer`, `none`
- Backend adapter types: `n8n_webhook`, `api`, `none`
- Runtime resolves adapters by exit definition at execution time.

## Book Appointment Reference Flow

Frontend:
1. CTA element carries `exitId=book_appointment_primary`.
2. Exit runtime bridge emits analytics event (`exit_triggered`).
3. Adapter runtime resolves frontend adapter and target.

Backend:
1. Exit definition maps to `n8n_webhook` target.
2. n8n orchestrates CRM routing, notifications, and follow-up logic.
3. Execution status is returned to caller and logged.

Governance:
- State can be toggled active/inactive without block code changes.
- Workflow target can be re-routed in exit config.

## Activation/Deactivation

- Exit state is stored in exit definition.
- Inactive exits return `skipped` in runtime execution.

## Analytics

- Trigger event names are governed in exit definitions.
- Rudder remains the unified event stream.
