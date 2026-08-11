import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from './AuthContext';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('authentication surface branding', () => {
  /** \u{1F534} ONE shared implementation - login renders the same component the sidebar does. */
  it('renders the complete logo through the shared brand component', () => {
    renderLogin();
    const brand = screen.getByTestId('application-brand');
    const logo = screen.getByTestId('application-logo');

    expect(brand.contains(logo)).toBe(true);
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('alt')).toBe('TrioLoo');
    expect(logo.style.width).toBe('auto');
    expect(logo.style.filter).toBe('');
  });

  /** \u{1F534} No wordmark text and no second logo beside the asset. */
  it('places no separate brand text beside the logo', () => {
    renderLogin();
    expect(screen.getByTestId('application-brand').textContent).toBe('');
    expect(screen.queryAllByTestId('application-logo')).toHaveLength(1);
  });

  it('carries the ratified login copy', () => {
    renderLogin();
    expect(screen.getByText('Welcome Back')).toBeTruthy();
    expect(screen.getByText('Please login to start your work today')).toBeTruthy();
  });

  /** The surface stays minimal - no marketing content was introduced with the logo. */
  it('keeps the surface minimal', () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    // One image on the whole surface: the logo. No illustration, no hero art.
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });
});
