import type { ProviderActionHandlerSubset, ProviderRuntimeHandler, OAuthProviderContext } from "../provider-runtime.ts";

import { optionalScalarString, optionalString, optionalStringArray } from "../../core/cast.ts";
import { xeroRequest, resolveTenantId, requireXeroGuid, xeroApiBases } from "./runtime-request.ts";

export const xeroProjectHandlers: ProviderActionHandlerSubset<"xero", ProviderRuntimeHandler<OAuthProviderContext>> = {
  async list_projects(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects`,
      method: "GET",
      query: {
        projectIds: optionalStringArray(input.project_ids)
          ?.map((value) => requireXeroGuid(value, "project_ids"))
          .join(","),
        contactID: optionalScalarString(input.contact_id),
        states: optionalScalarString(input.states),
        page: optionalScalarString(input.page),
        pageSize: optionalScalarString(input.page_size),
      },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async get_project(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async create_project(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects`,
      method: "POST",
      query: {},
      body: {
        contactId: input.contact_id,
        name: input.name,
        estimateAmount: input.estimate_amount,
        deadlineUtc: input.deadline_utc,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async update_project(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}`,
      method: "PUT",
      query: {},
      body: {
        contactId: input.contact_id,
        name: input.name,
        estimateAmount: input.estimate_amount,
        deadlineUtc: input.deadline_utc,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return (
      result ?? {
        updated: true,
        project_id: input.project_id,
        task_id: input.task_id,
        time_entry_id: input.time_entry_id,
      }
    );
  },
  async list_project_users(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/ProjectsUsers`,
      method: "GET",
      query: { page: optionalScalarString(input.page), pageSize: optionalScalarString(input.page_size) },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async list_project_tasks(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Tasks`,
      method: "GET",
      query: {
        page: optionalScalarString(input.page),
        pageSize: optionalScalarString(input.page_size),
        taskIds: optionalScalarString(input.task_ids),
        chargeType: optionalScalarString(input.charge_type),
      },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async get_project_task(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Tasks/${requireXeroGuid(input.task_id, "task_id")}`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async create_project_task(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Tasks`,
      method: "POST",
      query: {},
      body: {
        name: input.name,
        rate: input.rate,
        chargeType: input.charge_type,
        estimateMinutes: input.estimate_minutes,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async update_project_task(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Tasks/${requireXeroGuid(input.task_id, "task_id")}`,
      method: "PUT",
      query: {},
      body: {
        name: input.name,
        rate: input.rate,
        chargeType: input.charge_type,
        estimateMinutes: input.estimate_minutes,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return (
      result ?? {
        updated: true,
        project_id: input.project_id,
        task_id: input.task_id,
        time_entry_id: input.time_entry_id,
      }
    );
  },
  async delete_project_task(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Tasks/${requireXeroGuid(input.task_id, "task_id")}`,
      method: "DELETE",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return { deleted: true, project_id: input.project_id, task_id: input.task_id, time_entry_id: input.time_entry_id };
  },
  async list_time_entries(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Time`,
      method: "GET",
      query: {
        userId: optionalScalarString(input.user_id),
        taskId: optionalScalarString(input.task_id),
        invoiceId: optionalScalarString(input.invoice_id),
        contactId: optionalScalarString(input.contact_id),
        page: optionalScalarString(input.page),
        pageSize: optionalScalarString(input.page_size),
        states: optionalStringArray(input.states)?.join(","),
        isChargeable: optionalScalarString(input.is_chargeable),
        dateAfterUtc: optionalScalarString(input.date_after_utc),
        dateBeforeUtc: optionalScalarString(input.date_before_utc),
      },
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async get_time_entry(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Time/${requireXeroGuid(input.time_entry_id, "time_entry_id")}`,
      method: "GET",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return result;
  },
  async create_time_entry(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Time`,
      method: "POST",
      query: {},
      body: {
        userId: input.user_id,
        taskId: input.task_id,
        dateUtc: input.date_utc,
        duration: input.duration,
        description: input.description,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return result;
  },
  async update_time_entry(input, context) {
    const tenantId = await resolveTenantId(input, context);
    const result = await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Time/${requireXeroGuid(input.time_entry_id, "time_entry_id")}`,
      method: "PUT",
      query: {},
      body: {
        userId: input.user_id,
        taskId: input.task_id,
        dateUtc: input.date_utc,
        duration: input.duration,
        description: input.description,
      },
      idempotencyKey: optionalString(input.idempotency_key),
    });
    return (
      result ?? {
        updated: true,
        project_id: input.project_id,
        task_id: input.task_id,
        time_entry_id: input.time_entry_id,
      }
    );
  },
  async delete_time_entry(input, context) {
    const tenantId = await resolveTenantId(input, context);
    await xeroRequest(context, {
      tenantId,
      baseUrl: xeroApiBases.projects,
      path: `/Projects/${requireXeroGuid(input.project_id, "project_id")}/Time/${requireXeroGuid(input.time_entry_id, "time_entry_id")}`,
      method: "DELETE",
      query: {},
      body: undefined,
      idempotencyKey: undefined,
    });
    return { deleted: true, project_id: input.project_id, task_id: input.task_id, time_entry_id: input.time_entry_id };
  },
};
