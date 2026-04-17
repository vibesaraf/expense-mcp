import { userRepository } from "../db/repositories/index.js";
import type { RegisterUserInput } from "../api/validators/user.validator.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { generateUUID } from "../utils/uuid.js";

export class UserService {
  registerUser(input: RegisterUserInput) {
    const existing = userRepository.findByLrUserId(input.lrUserId);
    if (existing) {
      throw new ConflictError("User already registered", {
        lr_user_id: input.lrUserId,
      });
    }

    if (input.managerId) {
      const manager = userRepository.findById(input.managerId);
      if (!manager) {
        throw new NotFoundError("Manager", input.managerId);
      }
    }

    return userRepository.create({
      userId: generateUUID(),
      email: input.email,
      fullName: input.fullName,
      department: input.department,
      managerId: input.managerId,
      lrUserId: input.lrUserId,
    });
  }
}

export const userService = new UserService();
