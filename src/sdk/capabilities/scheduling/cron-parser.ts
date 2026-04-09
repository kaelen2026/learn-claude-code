export function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return (
    matchesField(parts[0], minute) &&
    matchesField(parts[1], hour) &&
    matchesField(parts[2], dayOfMonth) &&
    matchesField(parts[3], month) &&
    matchesField(parts[4], dayOfWeek)
  );
}

function matchesField(field: string, value: number): boolean {
  if (field === '*') return true;

  if (field.startsWith('*/')) {
    const step = Number.parseInt(field.slice(2), 10);
    return value % step === 0;
  }

  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (value >= start && value <= end) return true;
    } else if (Number.parseInt(part, 10) === value) {
      return true;
    }
  }

  return false;
}
