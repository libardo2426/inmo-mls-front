import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { es } from '@/lib/i18n/es';

type BackupCodesProps = { codes: readonly string[]; onContinue: () => void };

/** Muestra los códigos de respaldo una sola vez; no se puede continuar sin confirmar que se guardaron. */
export function BackupCodes({ codes, onContinue }: BackupCodesProps) {
  const savedId = useId();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = es.auth.activate.downloadName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <FieldGroup>
      <FieldDescription>{es.auth.activate.codesHelp}</FieldDescription>
      <ul className="bg-muted grid grid-cols-2 gap-2 rounded-lg p-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? es.auth.activate.copied : es.auth.activate.copyCodes}
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          {es.auth.activate.downloadCodes}
        </Button>
      </div>
      <Field orientation="horizontal">
        <Checkbox
          id={savedId}
          checked={saved}
          onCheckedChange={(value) => setSaved(value === true)}
        />
        <Label htmlFor={savedId}>{es.auth.activate.saved}</Label>
      </Field>
      <Button type="button" disabled={!saved} onClick={onContinue}>
        {es.auth.activate.continue}
      </Button>
    </FieldGroup>
  );
}
