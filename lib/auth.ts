export function validateAccessKey(key: string | null): boolean {
  if (!key) return false;
  
  const validKeys = (process.env.ACCESS_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
  
  // If no keys are configured, allow access (or deny depending on preference, here we deny for safety if auth is enabled)
  if (validKeys.length === 0) return false;

  return validKeys.includes(key);
}
