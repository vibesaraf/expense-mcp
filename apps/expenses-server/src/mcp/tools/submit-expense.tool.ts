import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { createTextResponse, createErrorResponse } from "../types.js";
import { DEFAULT_CATEGORIES } from "../../config/constants.js";
import { McpScopes } from "../../config/constants.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";

const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name) as [
  string,
  ...string[],
];

const submitExpenseInput = {
  category: z
    .enum(categoryNames as [string, ...string[]])
    .describe(
      "Expense category (Meals, Travel, Office Supplies, Software, Training)",
    ),

  amount: z
    .number()
    .positive()
    .describe("Expense amount in USD (must be greater than 0)"),

  currency: z
    .string()
    .length(3)
    .default("USD")
    .describe("Currency code (ISO 4217, e.g., USD, EUR)"),

  description: z
    .string()
    .min(10)
    .max(500)
    .describe("Detailed description of the expense (10-500 characters)"),

  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Date when expense occurred (YYYY-MM-DD format)"),

  receipt_url: z
    .string()
    .url()
    .optional()
    .describe("URL to receipt image or PDF (optional for small amounts)"),
};

export const submitExpenseTool = defineTool({
  name: "submit_expense",

  description: `Submit a new expense for approval. Employees can submit expenses for reimbursement.

Categories available:
- Meals: Business meals and client entertainment (max $100, receipt required)
- Travel: Transportation and accommodation (max $5000, receipt required)
- Office Supplies: Stationery, equipment, etc. (max $500)
- Software: Software subscriptions and licenses (max $1000)
- Training: Courses, conferences, certifications (max $3000, receipt required)

The expense will be created with 'pending' status and routed to the appropriate manager for approval.`,

  input: submitExpenseInput as any,

  scopes: [],

  handler: async (args, extra) => {
    try {
      const category = DEFAULT_CATEGORIES.find((c) => c.name === args.category);
      if (!category) {
        return createErrorResponse("Invalid category selected", {
          valid_categories: categoryNames,
        });
      }
      const categoryId = DEFAULT_CATEGORIES.indexOf(category) + 1;

      const restToken = await exchangeToken(
        extra.authInfo.token,
        McpScopes.EXPENSE_SUBMIT,
      );
      const data = await callRest(restToken, "POST", "/api/expenses", {
        categoryId,
        amount: args.amount,
        currency: args.currency ?? "USD",
        description: args.description,
        expenseDate: args.expense_date,
        receiptUrl: args.receipt_url,
      });
      return createTextResponse({ success: true, data });
    } catch (error) {
      if (error instanceof RestError) {
        return createErrorResponse(error.message, { status: error.status });
      }
      if (error instanceof TokenExchangeError) {
        return createErrorResponse(error.message);
      }
      return createErrorResponse("An unexpected error occurred");
    }
  },
});
