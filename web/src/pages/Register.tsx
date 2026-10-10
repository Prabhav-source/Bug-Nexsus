import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Field, Card } from '../components/ui';
import { extractError } from '../api/client';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, workspaceName || `${name}'s Workspace`);
      navigate('/');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="text-primary">
            <Hexagon size={34} strokeWidth={2.2} fill="currentColor" fillOpacity={0.15} />
          </span>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-text-primary text-2xl">BUGNEXUS</div>
            <div className="text-[11px] font-mono text-primary tracking-widest">2.0</div>
          </div>
        </div>
        <Card className="p-6 animate-slide-up">
          <h1 className="text-xl font-bold text-text-primary mb-1">Create account</h1>
          <p className="text-sm text-text-muted mb-6">Start tracking bugs with your team</p>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>
            )}
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" required autoComplete="name" />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.dev" required autoComplete="email" />
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Workspace name" hint="Optional — we'll create one for you">
              <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="My Team" autoComplete="organization" />
            </Field>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create account
            </Button>
          </form>
          <p className="text-xs text-text-muted text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-hover font-medium">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
