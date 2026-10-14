import "server-only";

/** Staff passwords use the shared console password helpers (../password.ts). */
export { burnPasswordCheck, generateTemporaryPassword, hashPassword, verifyPassword } from "../password";
