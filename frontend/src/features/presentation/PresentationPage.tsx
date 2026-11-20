import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icon';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import { pageGuides } from '@/lib/pageGuides';

const stops = [
  { path: '/how-it-works', title: 'Hospitals learn locally', label: '1. The learning loop', prompt: 'How can a shared model learn without receiving patient rows?', answer: 'Every simulated hospital receives the same starting model. Its trainer learns from local measurements and labels. FedAvg combines parameter changes using each hospital training count.', show: 'Choose the original FedAvg proof run. Show zero starting weights in round one, one hospital update, the weighted average, and the next round starting from that result.', icon: 'network' as const },
  { path: '/compare', title: 'Check the evidence', label: '2. The results', prompt: 'How do we know whether a model is useful?', answer: 'Use the separate test score, recall and false negatives. The centralized prediction baseline is a different method from FedAvg. The current Random Forest baseline was selected by development-data cross-validation.', show: 'Show the latest results. Explain accuracy and recall in one sentence each. State the method and development-training budget before comparing different pipelines.', icon: 'chart' as const },
  { path: '/assess', title: 'Use a versioned estimate', label: '3. The application', prompt: 'What does the user actually do?', answer: 'Enter eight measurements or choose a sample, generate an estimate, and review the saved result in history. The active registry model supplies predictions; its method and version are recorded.', show: 'Use the lower-risk sample. Show the estimate and model version, then open its history entry. State that this is a research estimate with no established clinical validity.', icon: 'pulse' as const },
];

export default function PresentationPage() {
  const [step, setStep] = useState(0);
  const stop = stops[step];
  return <div>
    <PageHeader eyebrow="Presentation companion" title="Learn. Check. Try." description="Three steps to explain the application. Each step opens the page that proves the idea." actions={<span className="badge">{step + 1} of {stops.length} stops</span>} />
    <div className="tour-grid"><nav className="tour-steps" aria-label="Presentation stops">{stops.map((item, index) => <button key={item.path} className={`tour-step ${step === index ? 'active' : ''}`} onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined}><span className="tour-step-indicator">{index < step ? <Icon name="check" size={13} /> : index+1}</span>{item.label}</button>)}</nav>
      <section className="card"><Icon name={stop.icon} size={26} /><h2 className="text-2xl font-medium mt-5">{stop.title}</h2><p className="eyebrow mt-8">The question to answer</p><h3 className="text-lg font-medium">{stop.prompt}</h3><p className="text-[var(--color-text-secondary)] leading-relaxed mt-3">{stop.answer}</p><div className="guide-panel"><p className="eyebrow">What to demonstrate</p><p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{stop.show}</p><Link className="btn-primary mt-5" to={stop.path}>Open {pageGuides[stop.path].title.toLowerCase()}</Link></div><details className="guide-panel"><summary className="text-sm font-medium cursor-pointer">Practice in Hinglish</summary><p className="guide-quote mt-4">{pageGuides[stop.path].say}</p></details><div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-[var(--color-border)]"><button className="btn-secondary" onClick={() => setStep(step-1)} disabled={step === 0}>Previous stop</button><button className="btn-secondary" onClick={() => setStep(step === stops.length-1 ? 0 : step+1)}>{step === stops.length-1 ? 'Start again' : 'Next stop'}</button></div></section>
    </div>
    {step === 0 && <section className="card mt-7"><ArchitectureDiagram walkthroughHref="/how-it-works" /></section>}
    <div className="research-note"><Icon name="info" size={15}/><p>Be precise about the scope: logical hospital partitions in one process, pooled training preprocessing and educational seeded noise. Explain these assumptions openly.</p></div>
  </div>;
}
