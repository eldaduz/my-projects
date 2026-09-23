import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { RequireAuth } from './RequireAuth';

function jsonResponse(ok, status, body) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('RequireAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('shows a loading status while the session is still being restored', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <AuthProvider>
        <RequireAuth fallback={<p>Please log in.</p>}>
          <p>Protected content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('Please log in.')).not.toBeInTheDocument();
  });

  test('renders the fallback for an unauthenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(false, 401, {
            error: { message: 'Not authenticated.', code: 'UNAUTHENTICATED' },
          }),
        ),
    );

    render(
      <AuthProvider>
        <RequireAuth fallback={<p>Please log in.</p>}>
          <p>Protected content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('Please log in.')).toBeInTheDocument());
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  test('renders the protected children for an authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(true, 200, { user: { email: 'me@example.com' } })),
    );

    render(
      <AuthProvider>
        <RequireAuth fallback={<p>Please log in.</p>}>
          <p>Protected content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('Protected content')).toBeInTheDocument());
    expect(screen.queryByText('Please log in.')).not.toBeInTheDocument();
  });
});
