const FIELD_RANGES: Array<[min: number, max: number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

export function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  if (!isValidCron(cron)) return false;

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

export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  return parts.every((field, index) =>
    validateField(field, FIELD_RANGES[index][0], FIELD_RANGES[index][1])
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

function validateField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;

  for (const part of field.split(',')) {
    if (!part) return false;

    if (part.startsWith('*/')) {
      const step = Number.parseInt(part.slice(2), 10);
      if (!Number.isInteger(step) || step <= 0 || step > max - min + 1) {
        return false;
      }
      continue;
    }

    if (part.includes('-')) {
      const [startText, endText] = part.split('-');
      const start = Number.parseInt(startText, 10);
      const end = Number.parseInt(endText, 10);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
      if (start < min || end > max || start > end) return false;
      continue;
    }

    const value = Number.parseInt(part, 10);
    if (!Number.isInteger(value) || value < min || value > max) {
      return false;
    }
  }

  return true;
}
