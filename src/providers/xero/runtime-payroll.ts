import type { ProviderActionHandlerSubset, ProviderRuntimeHandler, OAuthProviderContext } from "../provider-runtime.ts";

import { optionalScalarString, optionalString } from "../../core/cast.ts";
import { objectArray } from "../../core/cast.ts";
import { providerInputError } from "../provider-runtime.ts";
import { requireNewZealandPayroll, payrollLine } from "./runtime-payroll-region.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid, xeroApiBases } from "./runtime-request.ts";
export const xeroPayrollHandlers: ProviderActionHandlerSubset<"xero", ProviderRuntimeHandler<OAuthProviderContext>> = {
  async list_payroll_employees(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Employees`,
      method: "GET",
      query: { filter: optionalScalarString(input.filter), page: optionalScalarString(input.page) },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_payroll_employee_leave(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Employees/${requireXeroGuid(input.employee_id, "employee_id")}/Leave`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_payroll_employee_leave_balances(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Employees/${requireXeroGuid(input.employee_id, "employee_id")}/LeaveBalances`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_payroll_employee_leave_types(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Employees/${requireXeroGuid(input.employee_id, "employee_id")}/LeaveTypes`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_payroll_leave_periods(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Employees/${requireXeroGuid(input.employee_id, "employee_id")}/LeavePeriods`,
      method: "GET",
      query: { startDate: optionalScalarString(input.start_date), endDate: optionalScalarString(input.end_date) },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_payroll_leave_types(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/LeaveTypes`,
      method: "GET",
      query: { page: optionalScalarString(input.page), ActiveOnly: optionalScalarString(input.active_only) },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_timesheets(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets`,
      method: "GET",
      query: {
        page: optionalScalarString(input.page),
        filter: optionalScalarString(input.filter),
        status: optionalScalarString(input.status),
        startDate: optionalScalarString(input.start_date),
        endDate: optionalScalarString(input.end_date),
        sort: optionalScalarString(input.sort),
      },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async get_timesheet(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets/${requireXeroGuid(input.timesheet_id, "timesheet_id")}`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async create_timesheet(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    if (String(input.end_date) < String(input.start_date))
      throw providerInputError("end_date must not precede start_date.");
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets`,
      method: "POST",
      query: {},
      body: {
        payrollCalendarID: input.payroll_calendar_id,
        employeeID: input.employee_id,
        startDate: input.start_date,
        endDate: input.end_date,
        timesheetLines:
          input.timesheet_lines === undefined
            ? undefined
            : objectArray(input.timesheet_lines, "timesheet_lines", providerInputError).map(payrollLine),
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async add_timesheet_line(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets/${requireXeroGuid(input.timesheet_id, "timesheet_id")}/Lines`,
      method: "POST",
      query: {},
      body: payrollLine(input),
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async update_timesheet_line(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets/${requireXeroGuid(input.timesheet_id, "timesheet_id")}/Lines/${requireXeroGuid(input.timesheet_line_id, "timesheet_line_id")}`,
      method: "PUT",
      query: {},
      body: payrollLine(input),
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async approve_timesheet(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets/${requireXeroGuid(input.timesheet_id, "timesheet_id")}/Approve`,
      method: "POST",
      query: {},
      body: undefined,
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async revert_timesheet(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets/${requireXeroGuid(input.timesheet_id, "timesheet_id")}/RevertToDraft`,
      method: "POST",
      query: {},
      body: undefined,
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async delete_timesheet(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await requireNewZealandPayroll(context, tenantId);
    await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.payroll,
      path: `/Timesheets/${requireXeroGuid(input.timesheet_id, "timesheet_id")}`,
      method: "DELETE",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return { deleted: true, timesheet_id: input.timesheet_id };
  },
};
