import { useState, type FormEvent } from 'react';
import { Save, Bell, Bug } from 'lucide-react';
import { Card, Button, Field, Input } from '../components/ui';

export default function Settings() {
  const [saving, setSaving] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <form onSubmit={submit} className="space-y-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2"><Bell size={15} /> Notifications</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-text-primary">Email notifications</span>
                <p className="text-[11px] text-text-muted">Receive email when an issue is assigned to you</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-text-primary">In-app notifications</span>
                <p className="text-[11px] text-text-muted">Show banners for project activity</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-text-primary">AI assistance</span>
                <p className="text-[11px] text-text-muted">Enable AI-powered suggestions for severity and summaries</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2"><Bug size={15} /> Display</h3>
          <div className="space-y-3">
            <Field label="Accent color">
              <Input type="color" defaultValue="#FF1744" className="w-12 h-9 p-0 border-0 bg-transparent" />
            </Field>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-text-primary">Dark mode</span>
                <p className="text-[11px] text-text-muted">Always use the Crimson After Dark theme</p>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}><Save size={14} />Save changes</Button>
        </div>
      </form>
    </div>
  );
}

function Switch({ defaultChecked, disabled }: { defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors">
      <input type="checkbox" defaultChecked={defaultChecked} disabled={disabled} className="sr-only" />
      <span className="absolute inset-0 rounded-full bg-surface-hover" />
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          defaultChecked ? 'translate-x-4' : ''
        } ${disabled ? 'opacity-50' : ''}`}
      />
    </label>
  );
}
