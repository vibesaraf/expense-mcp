import { defineTool } from "../define-tool.js";
import { createTextResponse, createErrorResponse } from "../types.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";
import { McpScopes } from "../../config/constants.js";

export const whoAmITool = defineTool({
  name: "who_am_i",

  description: `Returns the authenticated user's profile information.

Returns:
- Name: full display name
- Email: email address
- Department: department the user belongs to
- Manager: full name of the user's manager (null if no manager)

Use this tool to confirm your identity and see your organizational context.`,

  input: {} as any,

  scopes: [],

  handler: async (_args, extra) => {
    try {
      const restToken = await exchangeToken(
        extra.authInfo.token,
        McpScopes.EXPENSE_VIEW_OWN,
      );
      const data = await callRest(restToken, "GET", "/api/users/me");
      return createTextResponse(data);
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
