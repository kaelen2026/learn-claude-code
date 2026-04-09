export function isSensitiveEnvPath(value: string): boolean {
  const normalized = normalizeSeparators(value);
  return /(^|\/)\.env(?:\.[\w-]+)?$/i.test(normalized);
}

export function commandTouchesSensitiveEnv(command: string): boolean {
  const normalized = normalizeSeparators(command);
  const readVerb = /^(?:cat|less|more|head|tail|grep|rg|sed|awk|cut|sort|uniq|strings|nl)\b/i;
  return (
    readVerb.test(normalized) &&
    /(^|[\s"'`=/])(?:\.\/)?(?:[^/\s"'`]+\/)*\.env(?:\.[\w-]+)?(?=$|[\s"'`|;&])/i.test(normalized)
  );
}

function normalizeSeparators(value: string): string {
  return value.trim().replace(/\\/g, '/');
}
