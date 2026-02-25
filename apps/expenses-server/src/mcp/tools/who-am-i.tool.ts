// =============================================================================
// MCP Tool: Who Am I
// =============================================================================
// Returns the authenticated user's profile information
// Required Scope: none (any authenticated user)
// =============================================================================

import { defineTool } from "../define-tool";
import { userRepository } from "../../db/repositories";
import { createTextResponse, createErrorResponse } from "../types";

/**
 * Who Am I Tool
 *
 * @scope none — any authenticated user
 * @rbac any authenticated user
 */
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
      const userId = extra.authInfo.clientId

      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        })
      }

      const user = userRepository.findById(userId)
      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        })
      }

      const manager = user.managerId
        ? userRepository.findById(user.managerId)
        : null

      return createTextResponse({
        name: user.fullName,
        email: user.email,
        department: user.department ?? null,
        manager: manager ? manager.fullName : null,
      })
    } catch (error) {
      if (error instanceof Error) {
        return createErrorResponse("Failed to fetch user information", {
          code: "INTERNAL_ERROR",
          message: error.message,
        })
      }

      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      })
    }
  },
})
