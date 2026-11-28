import { useState } from 'react';
import { downloadFile } from '@/lib/format';

export default function RecoveryKeyCard({ code, onContinue }: { code: string; onContinue: () => void }) {
  const [saved, setSaved] = useState(false);
  return <section className="space-y-5" aria-label="Save your recovery key">
    <h1 className="text-2xl font-medium">Save your recovery key.</h1>
    <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">Use this private key with your email address if you forget your password. Keep it in a password manager or a safe place. Anyone with this key can reset your password.</p>
    <label className="label" htmlFor="recovery-key">Your recovery key — shown only now</label>
    <textarea id="recovery-key" className="input font-mono text-sm break-all resize-none" rows={3} readOnly value={code} spellCheck={false} />
    <button type="button" className="btn-secondary" onClick={() => downloadFile('fedhealth-recovery-key.txt', `FedHealth account recovery key\n\n${code}\n\nKeep this private. Use with your account email to recover your password. A new key replaces this one after recovery.\n`, 'text/plain')}>Download recovery key</button>
    <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">This demo does not send password-reset emails. If you lose both your password and recovery key, self-service recovery will be unavailable. A replacement key makes any earlier key invalid.</p>
    <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} className="mt-1" />I have saved my recovery key securely.</label>
    <button type="button" className="btn-primary" disabled={!saved} onClick={onContinue}>Continue</button>
  </section>;
}
