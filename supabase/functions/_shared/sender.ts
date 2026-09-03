// Builds a safe "from" display name for outbound email.
// Guarantees no email address (personal or otherwise) can appear as a sender name.
export const EMAIL_FROM_ADDRESS = "noreply@flowstatesuite.co.uk";

export function sanitiseSenderName(name?: string | null): string {
  if (!name) return "";
  let clean = String(name)
    // Strip anything resembling an email address
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
    // Remove characters that would break the From header
    .replace(/["<>@,;:\\\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length > 60) clean = clean.slice(0, 60).trim();
  return clean;
}

export function buildFrom(schoolName?: string | null): string {
  const name = sanitiseSenderName(schoolName) || "FS Register";
  return `${name} <${EMAIL_FROM_ADDRESS}>`;
}
