export function isSensitiveEnvPath(value: string): boolean {
  return /(^|\/)\.env(?:\.[\w-]+)?$/i.test(value.trim());
}

export function commandTouchesSensitiveEnv(command: string): boolean {
  const normalized = command.trim();
  const readVerb = /^(?:cat|less|more|head|tail|grep|rg|sed|awk|cut|sort|uniq|strings|nl)\b/i;
  return (
    readVerb.test(normalized) &&
    /(^|[\s"'`=/])(?:\.\/)?(?:[^/\s"'`]+\/)*\.env(?:\.[\w-]+)?(?=$|[\s"'`|;&])/i.test(normalized)
  );
}
