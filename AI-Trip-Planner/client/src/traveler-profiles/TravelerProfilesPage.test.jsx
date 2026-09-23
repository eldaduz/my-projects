import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TravelerProfilesPage } from './TravelerProfilesPage';

function jsonResponse(status, body) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('TravelerProfilesPage', () => {
  let profiles;

  beforeEach(() => {
    profiles = [
      {
        id: '1',
        profileName: 'My Partner',
        ageGroup: 'adult',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const method = options.method || 'GET';

        if (url === '/api/traveler-profiles' && method === 'GET') {
          return jsonResponse(200, { profiles });
        }

        if (url === '/api/traveler-profiles' && method === 'POST') {
          const body = JSON.parse(options.body);
          if (!body.profileName?.trim()) {
            return jsonResponse(400, {
              error: { message: 'Profile name is required.', code: 'INVALID_PROFILE_NAME' },
            });
          }
          const created = {
            id: '2',
            profileName: body.profileName,
            ageGroup: body.ageGroup || undefined,
            pace: body.pace || undefined,
            preferences: body.preferences || undefined,
            dietaryRestrictions: body.dietaryRestrictions?.length ? body.dietaryRestrictions : undefined,
            createdAt: 'now',
            updatedAt: 'now',
          };
          profiles = [created, ...profiles];
          return jsonResponse(201, { profile: created });
        }

        const patchMatch = method === 'PATCH' && url.match(/^\/api\/traveler-profiles\/(.+)$/);
        if (patchMatch) {
          const [, id] = patchMatch;
          const body = JSON.parse(options.body);
          profiles = profiles.map((profile) =>
            profile.id === id ? { ...profile, ...body } : profile,
          );
          return jsonResponse(200, { profile: profiles.find((profile) => profile.id === id) });
        }

        const deleteMatch = method === 'DELETE' && url.match(/^\/api\/traveler-profiles\/(.+)$/);
        if (deleteMatch) {
          const [, id] = deleteMatch;
          profiles = profiles.filter((profile) => profile.id !== id);
          return { ok: true, status: 204, headers: { get: () => null }, json: async () => null };
        }

        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('lists existing profiles', async () => {
    render(<TravelerProfilesPage />);

    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());
    expect(screen.getByText('My Partner').parentElement).toHaveTextContent('adult');
  });

  test('creates a new profile and shows it in the list', async () => {
    const user = userEvent.setup();
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/^name/i), 'New Friend');
    await user.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() => expect(screen.getByText('New Friend')).toBeInTheDocument());
  });

  test('shows a safe validation error from the server without crashing', async () => {
    const user = userEvent.setup();
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/profile name is required/i),
    );
  });

  test('edits an existing profile', async () => {
    const user = userEvent.setup();
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText('Updated Name')).toBeInTheDocument());
  });

  test('saves pace and a preference category on create', async () => {
    const user = userEvent.setup();
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/^name/i), 'New Friend');
    await user.selectOptions(screen.getByLabelText(/pace/i), 'intensive');
    await user.click(
      screen.getByLabelText('Block', { selector: '#profile-pref-nightlife-block' }),
    );
    await user.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() => expect(screen.getByText('New Friend')).toBeInTheDocument());
    const created = profiles.find((profile) => profile.profileName === 'New Friend');
    expect(created.pace).toBe('intensive');
    expect(created.preferences.nightlife).toBe('block');
  });

  test('saves selected dietary restrictions on create', async () => {
    const user = userEvent.setup();
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/^name/i), 'New Friend');
    await user.click(screen.getByLabelText('Nuts'));
    await user.click(screen.getByLabelText('Vegan'));
    await user.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() => expect(screen.getByText('New Friend')).toBeInTheDocument());
    const created = profiles.find((profile) => profile.profileName === 'New Friend');
    expect(created.dietaryRestrictions).toEqual(['nuts', 'vegan']);
  });

  test('deletes a profile after the user confirms', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(screen.queryByText('My Partner')).not.toBeInTheDocument());
    window.confirm.mockRestore();
  });

  test('keeps the profile when the user cancels the delete confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TravelerProfilesPage />);
    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByText('My Partner')).toBeInTheDocument();
    window.confirm.mockRestore();
  });
});
