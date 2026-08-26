import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchPatientSettings, updatePatientSettings } from '@/lib/api';
import type { PatientSettings } from '@/types';

export default function Settings({ dark, setDark, fontScale, setFontScale }: { dark: boolean; setDark: (v: boolean) => void; fontScale: number; setFontScale: (v: number) => void }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PatientSettings | null>(null);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (!user) return;
    fetchPatientSettings(user.id).then(s => { setSettings(s); if (s) { setDark(s.theme === 'dark'); setFontScale(s.font_scale); setLanguage(s.language); } });
  }, [user, setDark, setFontScale]);

  const patch = async (updates: Partial<PatientSettings>) => {
    if (!user) return;
    setSettings(prev => prev ? { ...prev, ...updates } : prev);
    await updatePatientSettings(user.id, updates);
  };

  const themeChange = (value: boolean) => { setDark(value); patch({ theme: value ? 'dark' : 'light' }); };
  const scaleChange = (value: number) => { setFontScale(value); patch({ font_scale: value }); };

  return <section className="page active">
    <div className="card" style={{maxWidth: 820}}>
      <div className="card-header"><div><h2>Settings</h2><p>Control appearance, accessibility and medication reminder preferences.</p></div></div>

      <div className="settings-group-title">Appearance</div>
      <div className="theme-setting">
        <div className="theme-setting-copy"><strong>Dark theme</strong><p>Use a dark, high-contrast application surface.</p></div>
        <label className="theme-switch"><input type="checkbox" checked={dark} onChange={e => themeChange(e.target.checked)} /><span className="theme-slider" /></label>
      </div>
      <div className="font-scale-setting">
        <div style={{flex:1}}><div className="font-scale-head"><div className="font-scale-copy"><strong>Font scaling factor</strong><p>Increases readable text in the main application area without changing the sidebar layout.</p></div><span className="font-scale-value">{fontScale}%</span></div>
          <div className="font-scale-control"><span className="font-scale-min">100%</span><input type="range" min="100" max="140" step="5" value={fontScale} onChange={e => scaleChange(Number(e.target.value))}/><span className="font-scale-max">140%</span></div>
          <div className="font-scale-ticks"><span>Standard</span><span>Comfortable</span><span>Large</span></div><div className="font-scale-status">Current: {fontScale < 115 ? 'Standard' : fontScale < 130 ? 'Comfortable' : 'Large'}</div>
        </div>
      </div>

      <div className="settings-group-title">Language</div>
      <div className="preference-setting">
        <div className="preference-setting-copy"><strong>Application language</strong><p>Language preference is saved with your patient settings.</p></div>
        <select value={language} onChange={e => { setLanguage(e.target.value); patch({language: e.target.value}); }} style={{padding:'9px 12px',borderRadius:9,border:'1px solid var(--border)',background:'var(--card-bg)',color:'var(--text)'}}>
          <option value="en">English</option><option value="hi">हिन्दी</option><option value="kn">ಕನ್ನಡ</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option><option value="ml">മലയാളം</option>
        </select>
      </div>

      <div className="settings-group-title">Medication & Reminders</div>
      <Toggle label="Medication reminders" description="Show medication reminder state in the app." checked={settings?.medication_reminders ?? true} onChange={v => patch({medication_reminders:v})}/>
      <Toggle label="Reminder sound" description="Enable reminder sound preference." checked={settings?.reminder_sound ?? true} onChange={v => patch({reminder_sound:v})}/>
      <Toggle label="Reminder vibration" description="Enable vibration preference where supported by the device." checked={settings?.reminder_vibration ?? true} onChange={v => patch({reminder_vibration:v})}/>
      <Toggle label="Food interaction alerts" description="Allow validated food-drug interaction alerts to be surfaced." checked={settings?.food_interaction_alerts ?? true} onChange={v => patch({food_interaction_alerts:v})}/>
    </div>
  </section>;
}

function Toggle({label, description, checked, onChange}:{label:string;description:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return <div className="preference-setting"><div className="preference-setting-copy"><strong>{label}</strong><p>{description}</p></div><label className="preference-switch"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="preference-slider"/></label></div>;
}
