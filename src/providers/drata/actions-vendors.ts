import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";
import { drataIdentifier as id, drataPageOutput, drataPageProperties, drataRecordOutput } from "./action-schemas.ts";

const vendorFields = {
  name: s.nonEmptyString("The vendor name."),
  category: s.stringEnum([
    "ENGINEERING",
    "PRODUCT",
    "MARKETING",
    "CS",
    "SALES",
    "FINANCE",
    "HR",
    "ADMINISTRATIVE",
    "SECURITY",
  ]),
  risk: s.stringEnum(["NONE", "LOW", "MODERATE", "HIGH"]),
  critical: s.boolean(),
  isSubProcessor: s.boolean(),
  isSubProcessorActive: s.boolean(),
  userId: id,
  url: s.string(),
  privacyUrl: s.string(),
  termsUrl: s.string(),
  servicesProvided: s.string(),
  dataStored: s.string(),
  location: s.string(),
  hasPii: s.boolean(),
  passwordPolicy: s.stringEnum(["USERNAME_PASSWORD", "SSO", "LDAP"]),
  passwordRequiresMinLength: s.boolean(),
  passwordRequiresNumber: s.boolean(),
  passwordRequiresSymbol: s.boolean(),
  passwordMfaEnabled: s.boolean(),
  passwordMinLength: s.nonNegativeInteger("The password length requirement."),
  accountManagerName: s.string(),
  accountManagerEmail: s.email("The account manager's email."),
  isComplianceReviewRequired: s.boolean(),
  renewalDate: s.string(),
  renewalScheduleType: s.stringEnum(["ONE_MONTH", "TWO_MONTHS", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "CUSTOM"]),
  notes: s.string(),
  confirmed: s.boolean(),
  impactLevel: s.stringEnum(["INSIGNIFICANT", "MINOR", "MODERATE", "MAJOR", "CRITICAL", "UNSCORED"]),
};
const reviewFields = {
  reviewDeadlineAt: s.string(),
  securityReviewStatus: s.stringEnum(["NOT_YET_STARTED", "IN_PROGRESS", "COMPLETED", "NOT_REQUIRED"]),
  securityReviewType: s.stringEnum(["SECURITY", "SOC_REPORT", "UPLOAD_REPORT"]),
  requesterUserId: id,
};

export const drataVendorsActions: ActionDefinition[] = [
  {
    name: "create_vendor",
    description: "Create a vendor in the compliance inventory.",
    inputSchema: s.object(
      "Create a vendor in the compliance inventory.",
      { ...vendorFields },
      { required: ["name", "category", "risk", "critical", "isSubProcessor", "isSubProcessorActive"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "update_vendor",
    description: "Change selected vendor fields, preserving other writable fields from the current record.",
    inputSchema: s.object(
      "Change selected vendor fields, preserving other writable fields from the current record.",
      { vendorId: id, ...vendorFields },
      { required: ["vendorId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "archive_vendor",
    description: "Archive a vendor while preserving its other writable fields.",
    inputSchema: s.object(
      "Archive a vendor while preserving its other writable fields.",
      { vendorId: id },
      { required: ["vendorId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "bulk_update_vendors",
    description:
      "Apply up to 50 vendor updates sequentially, reporting each success or failure. Changes to each vendor preserve unspecified writable fields.",
    inputSchema: s.object(
      "Apply up to 50 vendor updates sequentially, reporting each success or failure. Changes to each vendor preserve unspecified writable fields.",
      {
        updates: s.array(s.object({ vendorId: id, ...vendorFields }, { required: ["vendorId"] }), {
          minItems: 1,
          maxItems: 50,
        }),
      },
      { required: ["updates"] },
    ),
    outputSchema: s.looseObject("Per-vendor results."),
  },
  {
    name: "create_asset",
    description: "Create a physical or virtual asset.",
    inputSchema: s.object(
      "Create a physical or virtual asset.",
      {
        name: s.string({ minLength: 1, maxLength: 191 }),
        description: s.string({ maxLength: 191 }),
        assetClassTypes: s.array(
          s.stringEnum([
            "HARDWARE",
            "POLICY",
            "DOCUMENT",
            "PERSONNEL",
            "SOFTWARE",
            "CODE",
            "CONTAINER",
            "COMPUTE",
            "NETWORKING",
            "DATABASE",
            "STORAGE",
          ]),
          { minItems: 1 },
        ),
        assetType: s.stringEnum(["PHYSICAL", "VIRTUAL"]),
        ownerId: id,
      },
      { required: ["name", "description", "assetClassTypes", "assetType", "ownerId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "create_vendor_security_review",
    description:
      "Create a vendor security review. Only COMPLETED reviews count as past reviews; scheduled shells do not.",
    inputSchema: s.object(
      "Create a vendor security review. Only COMPLETED reviews count as past reviews; scheduled shells do not.",
      { vendorId: id, ...reviewFields },
      { required: ["vendorId", "reviewDeadlineAt", "securityReviewStatus", "securityReviewType", "requesterUserId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "create_vendor_security_review_with_file",
    description:
      "Create a vendor security review with a transit file attachment. Only COMPLETED reviews count as past reviews.",
    inputSchema: s.object(
      "Create a vendor security review with a transit file attachment. Only COMPLETED reviews count as past reviews.",
      {
        vendorId: id,
        ...reviewFields,
        file: s.transitFile(),
        title: s.nonEmptyString("The review title."),
        requestedAt: s.string(),
        documentType: s.stringEnum([
          "COMPLIANCE_REPORT",
          "COMPLIANCE_REPORT_REVIEW",
          "BRIDGE_LETTER",
          "UPLOADED_COMPLIANCE_REPORT_REVIEW",
          "QUESTIONNAIRE_ATTACHMENT",
          "SOC_DOCUMENT",
          "QUESTIONNAIRE_REPORT",
        ]),
      },
      {
        required: [
          "vendorId",
          "reviewDeadlineAt",
          "securityReviewStatus",
          "securityReviewType",
          "requesterUserId",
          "file",
          "title",
        ],
      },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_vendor_security_reviews",
    description:
      "List vendor security reviews. NOT_YET_STARTED and NOT_REQUIRED records are pending shells, not completed reviews.",
    inputSchema: s.object(
      "List vendor security reviews. NOT_YET_STARTED and NOT_REQUIRED records are pending shells, not completed reviews.",
      {
        vendorId: id,
        statuses: s.array(s.string()),
        types: s.array(s.string()),
        decisions: s.array(s.string()),
        ...drataPageProperties,
      },
      { required: ["vendorId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_vendor_security_review",
    description: "Get one vendor security review.",
    inputSchema: s.object(
      "Get one vendor security review.",
      { vendorId: id, securityReviewId: id, expand: drataPageProperties.expand },
      { required: ["vendorId", "securityReviewId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_security_review_actions",
    description: "Read the available actions and history for a vendor security review.",
    inputSchema: s.object(
      "Read the available actions and history for a vendor security review.",
      { vendorId: id, securityReviewId: id, ...drataPageProperties },
      { required: ["vendorId", "securityReviewId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "list_security_review_questionnaires",
    description: "Read questionnaires attached to a vendor security review.",
    inputSchema: s.object(
      "Read questionnaires attached to a vendor security review.",
      { vendorId: id, securityReviewId: id, ...drataPageProperties },
      { required: ["vendorId", "securityReviewId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "send_vendor_questionnaire",
    description:
      "Send a real questionnaire email to a vendor. This cannot be unsent; require the user to approve the vendor, recipient and message before executing.",
    inputSchema: s.object(
      "Send a real questionnaire email to a vendor. This cannot be unsent; require the user to approve the vendor, recipient and message before executing.",
      { vendorId: id, recipientEmail: s.email("The questionnaire recipient."), message: s.string() },
      { required: ["vendorId", "recipientEmail"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_vendor_questionnaires",
    description: "List vendor questionnaires. An empty collection alone does not prove the vendor exists.",
    inputSchema: s.object(
      "List vendor questionnaires. An empty collection alone does not prove the vendor exists.",
      { vendorId: id, ...drataPageProperties },
      { required: ["vendorId"] },
    ),
    outputSchema: drataPageOutput,
  },
  {
    name: "get_vendor_questionnaire",
    description: "Get one vendor questionnaire and its send status.",
    inputSchema: s.object(
      "Get one vendor questionnaire and its send status.",
      { vendorId: id, questionnaireId: id },
      { required: ["vendorId", "questionnaireId"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "get_vendor_questionnaire_answers",
    description: "Read a vendor's questionnaire answers.",
    inputSchema: s.object(
      "Read a vendor's questionnaire answers.",
      { vendorId: id, questionnaireId: id },
      { required: ["vendorId", "questionnaireId"] },
    ),
    outputSchema: s.unknown("The vendor questionnaire answers."),
  },
  {
    name: "create_vendor_type",
    description: "Create a vendor type.",
    inputSchema: s.object(
      "Create a vendor type.",
      { name: s.nonEmptyString("The vendor type name."), description: s.string() },
      { required: ["name"] },
    ),
    outputSchema: drataRecordOutput,
  },
  {
    name: "list_vendor_types",
    description: "List configured vendor types.",
    inputSchema: s.object("List configured vendor types.", { ...drataPageProperties }, { required: [] }),
    outputSchema: drataPageOutput,
  },
].map((action) => defineProviderAction("drata", action));
