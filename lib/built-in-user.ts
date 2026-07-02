export const BUILT_IN_USER = {
  id: "builtin_deo",
  username: "deo",
  password: "deo2026",
  balance: 0,
} as const;

export function verifyBuiltInUserCredentials(username: string, password: string): boolean {
  return username === BUILT_IN_USER.username && password === BUILT_IN_USER.password;
}

export function isBuiltInUserId(userId: string): boolean {
  return userId === BUILT_IN_USER.id;
}
