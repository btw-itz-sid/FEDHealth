import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { guideFor } from '@/lib/pageGuides';
import Icon from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';

export default function GuideDrawer({ path, onClose }: { path: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const guide = guideFor(path, user?.role);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [onClose]);
  return <>
    <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
    <div className="guide-drawer" role="dialog" aria-modal="true" aria-labelledby="guide-title" ref={panel}>
      <div className="flex items-center justify-between mb-9"><p className="eyebrow mb-0">Presentation companion</p><button className="icon-button" onClick={onClose} aria-label="Close page explanation"><Icon name="close" /></button></div>
      <h2 id="guide-title">{guide.title}</h2><p className="guide-body mt-4">{guide.purpose}</p>
      <div className="guide-panel"><p className="eyebrow">What to show</p><ol className="guide-body list-decimal pl-4">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
      <div className="guide-panel"><p className="eyebrow">In your own words</p><p className="guide-quote">{guide.say}</p></div>
      {user?.role !== 'patient' && <div className="guide-panel"><Link to="/presentation" className="btn-secondary" onClick={onClose}><Icon name="play" size={16} />Full project walkthrough</Link></div>}
    </div>
  </>;
}
