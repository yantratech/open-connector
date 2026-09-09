import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
const timesheetLine = s.object(
  {
    date: s.date("The work date."),
    earnings_rate_id: s.uuid("The earnings rate ID."),
    tracking_item_id: s.uuid("The tracking item ID."),
    number_of_units: s.number({ minimum: 0 }),
  },
  { required: ["date", "earnings_rate_id", "number_of_units"] },
);
export const xeroPayrollActions: ActionDefinition[] = [
  {
    name: "list_payroll_employees",
    description:
      "List payroll employees. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.employees.read", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), filter: s.string("filter", {}), page: s.integer({}) },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_payroll_employee_leave",
    description:
      "List payroll employee leave. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.employees.read", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), employee_id: s.uuid("employee_id") },
      { required: ["employee_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_payroll_employee_leave_balances",
    description:
      "List payroll employee leave balances. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.employees.read", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), employee_id: s.uuid("employee_id") },
      { required: ["employee_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_payroll_employee_leave_types",
    description:
      "List payroll employee leave types. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.employees.read", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), employee_id: s.uuid("employee_id") },
      { required: ["employee_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_payroll_leave_periods",
    description:
      "List payroll leave periods. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.employees.read", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        employee_id: s.uuid("employee_id"),
        start_date: s.date("start_date"),
        end_date: s.date("end_date"),
      },
      { required: ["employee_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_payroll_leave_types",
    description:
      "List payroll leave types. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.settings.read", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), page: s.integer({}), active_only: s.boolean({}) },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "list_timesheets",
    description:
      "List timesheets. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets.read", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        page: s.integer({}),
        filter: s.string("filter", {}),
        status: s.string("status", {}),
        start_date: s.string("start_date", {}),
        end_date: s.string("end_date", {}),
        sort: s.string("sort", {}),
      },
      { required: [] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "get_timesheet",
    description:
      "Get timesheet. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets.read", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), timesheet_id: s.uuid("timesheet_id") },
      { required: ["timesheet_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "create_timesheet",
    description:
      "Create timesheet. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        payroll_calendar_id: s.uuid("The payroll calendar."),
        employee_id: s.uuid("The employee ID."),
        start_date: s.date("The first day of the timesheet."),
        end_date: s.date("The last day of the timesheet."),
        timesheet_lines: s.array(timesheetLine),
      },
      { required: ["payroll_calendar_id", "employee_id", "start_date", "end_date"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "add_timesheet_line",
    description:
      "Add timesheet line. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        timesheet_id: s.uuid("timesheet_id"),
        date: s.date("The work date."),
        earnings_rate_id: s.uuid("The earnings rate."),
        tracking_item_id: s.uuid("The tracking item."),
        number_of_units: s.number({ minimum: 0 }),
      },
      { required: ["timesheet_id", "date", "earnings_rate_id", "number_of_units"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "update_timesheet_line",
    description:
      "Update timesheet line. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        timesheet_id: s.uuid("timesheet_id"),
        timesheet_line_id: s.uuid("timesheet_line_id"),
        date: s.date("The work date."),
        earnings_rate_id: s.uuid("The earnings rate."),
        tracking_item_id: s.uuid("The tracking item."),
        number_of_units: s.number({ minimum: 0 }),
      },
      { required: ["timesheet_id", "timesheet_line_id", "date", "earnings_rate_id", "number_of_units"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "approve_timesheet",
    description:
      "Approve timesheet. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        timesheet_id: s.uuid("timesheet_id"),
      },
      { required: ["timesheet_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "revert_timesheet",
    description:
      "Revert timesheet. Payroll NZ only; the selected tenant's organisation version is verified before execution.",
    requiredScopes: ["payroll.timesheets", "accounting.settings.read"],
    inputSchema: s.object(
      {
        tenant_id: s.uuid("The connected organisation ID."),
        idempotency_key: s.string({ minLength: 1, maxLength: 128 }),
        timesheet_id: s.uuid("timesheet_id"),
      },
      { required: ["timesheet_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
  {
    name: "delete_timesheet",
    description:
      "Delete timesheet. Payroll NZ only; the selected tenant's organisation version is verified before execution. Permanently removes the timesheet.",
    requiredScopes: ["payroll.timesheets", "accounting.settings.read"],
    inputSchema: s.object(
      { tenant_id: s.uuid("The connected organisation ID."), timesheet_id: s.uuid("timesheet_id") },
      { required: ["timesheet_id"] },
    ),
    outputSchema: s.looseObject(
      "The Xero response, including provider validation details and pagination when returned.",
    ),
  },
].map((action) => defineProviderAction("xero", action));
