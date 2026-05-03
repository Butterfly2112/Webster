import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { register } from '../api/auth';

export default function Register() {
  const [login, setLogin] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');


  const mutation = useMutation({
    mutationFn: () => register({ login, username, email, password }),
    onSuccess: (data) => setMessage(data.message),
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Unable to register. Please try again.');
    },
  });

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate(); }}>
      <div>
        <input placeholder="Login" value={login} onChange={e => setLogin(e.target.value)} />
      </div>
      <div>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      </div>
      <div>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <button type="submit" disabled={mutation.isPending}>Register</button>
      {message && <div>{message}</div>}
      {error && <div>{error}</div>}
    </form>
  );
}
