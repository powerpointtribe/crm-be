/**
 * Mask a phone for staff who may see claims but not contact details:
 * "+2348031234567" -> "+234*****67", "08031234567" -> "0803*****67".
 */
export function maskPhone(phone: string | undefined | null): string {
  const p = (phone ?? '').replace(/[\s()-]/g, '');
  if (p.length <= 6) return '*'.repeat(p.length);
  return `${p.slice(0, 4)}*****${p.slice(-2)}`;
}
