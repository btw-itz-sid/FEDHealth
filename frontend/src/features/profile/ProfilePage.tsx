import { Link } from 'react-router-dom';
import DataControls from './DataControls';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icon';

export default function ProfilePage() {
  const {user}=useAuth();
  const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
  const [saving,setSaving]=useState(false);
  const [visible,setVisible]=useState(false);
  const [message,setMessage]=useState<{type:'success'|'error';text:string}|null>(null);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setMessage(null);if(form.newPassword!==form.confirmPassword){setMessage({type:'error',text:'The new passwords do not match.'});return;}setSaving(true);try{await api.changePassword(form.currentPassword,form.newPassword);setForm({currentPassword:'',newPassword:'',confirmPassword:''});setMessage({type:'success',text:'Your password has been updated.'});}catch(error){setMessage({type:'error',text:error instanceof Error?error.message:'Could not update your password.'});}finally{setSaving(false);}};
  return <div><PageHeader eyebrow="Workspace / Account" title="Account settings" description="Your identity, workspace access and sign-in security."/>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"><section className="card lg:col-span-2"><div className="flex items-center gap-4 mb-7"><span className="avatar" style={{width:48,height:48,fontSize:16}}>{user?.firstName?.[0]}{user?.lastName?.[0]}</span><div><h2 className="text-lg font-medium">{user?.firstName} {user?.lastName}</h2><p className="text-xs text-[var(--color-text-muted)] mt-1 capitalize">{user?.role} workspace</p></div></div><dl><div className="small-definition"><dt>Email address</dt><dd className="break-all">{user?.email}</dd></div><div className="small-definition"><dt>Workspace role</dt><dd className="capitalize">{user?.role}</dd></div><div className="small-definition"><dt>Account access</dt><dd>{user?.isActive?'Active':'Inactive'}</dd></div></dl><p className="text-xs text-[var(--color-text-muted)] mt-6 leading-relaxed">Your role determines the tools available in this workspace. Role changes are managed by an administrator.</p></section>
    <form onSubmit={submit} className="card lg:col-span-3 space-y-5"><div className="section-heading"><div><h2>Sign-in security</h2><p>Update your password using your existing credentials.</p></div><Icon name="lock" size={20}/></div>{message&&<div className={message.type==='error'?'form-feedback':'rounded-lg border border-[var(--color-border)] p-3 text-sm'} role={message.type==='error'?'alert':'status'}>{message.text}</div>}{([{key:'currentPassword',label:'Current password',autocomplete:'current-password'},{key:'newPassword',label:'New password',autocomplete:'new-password'},{key:'confirmPassword',label:'Confirm new password',autocomplete:'new-password'}] as const).map((field)=><div key={field.key}><label className="label" htmlFor={field.key}>{field.label}</label><input id={field.key} type={visible?'text':'password'} className="input" autoComplete={field.autocomplete} required minLength={field.key==='currentPassword'?undefined:8} maxLength={128} value={form[field.key]} onChange={(event)=>setForm({...form,[field.key]:event.target.value})} disabled={saving}/></div>)}<label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]"><input type="checkbox" checked={visible} onChange={(event)=>setVisible(event.target.checked)}/>Show passwords</label><div className="border-t border-[var(--color-border)] pt-5 flex flex-wrap gap-4 items-center"><button type="submit" className="btn-primary" disabled={saving}>{saving?'Updating password…':'Update password'}</button><p className="text-xs text-[var(--color-text-muted)]">Use at least 8 characters.</p></div></form></div>
    <DataControls/><p className="mt-6 text-sm"><Link to="/privacy" className="section-link">Data & privacy</Link></p>
  </div>;
}
