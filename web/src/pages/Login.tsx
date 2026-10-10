import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Field, Card } from '../components/ui';
import { extractError } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
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
          <h1 className="text-xl font-bold text-text-primary mb-1">Welcome back</h1>
          <p className="text-sm text-text-muted mb-6">Sign in to your workspace</p>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.dev" required autoComplete="email" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>
          <p className="text-xs text-text-muted text-center mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:text-primary-hover font-medium">
              Create one
            </Link>
          </p>
        </Card>
        <p className="text-[11px] text-text-muted text-center mt-6 font-mono">
          Demo: ava@bugnexus.dev / devpassword123
        </p>
      </div>
    </div>
  );
}
