const GOOGLE_AUTH_URL = '/api/auth/google';

export default function GoogleLogin() {
  return (
    <a href={GOOGLE_AUTH_URL}>
      <button>Login with Google</button>
    </a>
  );
}
