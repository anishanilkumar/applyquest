import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mentorMode, setMentorMode] = useState(false);
    const [mentorPassword, setMentorPassword] = useState('');
    const navigate = useNavigate();
    const { login, mentorLogin } = useAppContext();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = await userService.login(email, password);
            await login(token);
            toast.success('Signed in');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError('Invalid email or password');
            toast.error('Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleMentorAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await mentorLogin(mentorPassword);
            toast.success('Read-only view');
            navigate('/');
        } catch (err: any) {
            setError('Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full flex flex-col gap-4">
                <header className="flex items-center justify-between border-b-2 border-engrave pb-3">
                    <span className="wordmark">ApplyQuest</span>
                    <span className="label">{mentorMode ? 'Mentor' : 'Sign in'}</span>
                </header>

                <div className="instrument">
                    {error && (
                        <div className="verdict mb-5" style={{ ['--c' as any]: 'var(--gold)' }} role="alert">{error}</div>
                    )}

                    {!mentorMode ? (
                        <>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="field-label" htmlFor="email">Email</label>
                                    <input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="input" placeholder="you@example.com" required />
                                </div>
                                <div>
                                    <label className="field-label" htmlFor="password">Password</label>
                                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                        className="input" required />
                                </div>
                                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                                    {loading ? 'Signing in' : 'Sign in'}
                                </button>
                            </form>

                            <div className="mt-5 pt-5 border-t-2 border-engrave">
                                <button onClick={() => { setMentorMode(true); setError(''); }} className="btn w-full">
                                    <Eye size={18} strokeWidth={1.6} />
                                    Mentor access
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleMentorAccess} className="space-y-4">
                            <p className="text-ink-dim">Read-only access to the search's progress.</p>
                            <div>
                                <label className="field-label" htmlFor="mentor">Access password</label>
                                <input id="mentor" type="password" value={mentorPassword} onChange={(e) => setMentorPassword(e.target.value)}
                                    className="input" autoFocus required />
                            </div>
                            <button type="submit" disabled={loading} className="btn btn-primary w-full">
                                {loading ? 'Checking' : 'View progress'}
                            </button>
                            <button type="button" onClick={() => { setMentorMode(false); setError(''); setMentorPassword(''); }}
                                className="btn btn-quiet w-full">
                                Back to sign in
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
