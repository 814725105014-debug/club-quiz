export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (value: string | number | null | undefined) => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const row of rows) lines.push(row.map(esc).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
