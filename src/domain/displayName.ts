/**
 * The visningsnavn someone with a Vipps name may use: the name itself or one of its
 * short forms – never free text, so nobody can pose as someone else.
 * The same rule runs in the database (`display_name_options`, 0068) and in the
 * `vipps-login` function's first name; change all three together.
 *
 *   'Mari Haugen'      → ['Mari Haugen', 'Mari H.', 'Mari']
 *   'Mari Anne Haugen' → ['Mari Anne Haugen', 'Mari H.', 'Mari']
 *   'Mari'             → ['Mari']
 */
export function displayNameOptions(fullName: string): string[] {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.slice(0, 1);
  const first = parts[0];
  return [parts.join(' '), `${first} ${parts[parts.length - 1][0]}.`, first];
}
