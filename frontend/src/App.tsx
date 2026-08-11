import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './auth/LoginPage';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './shell/AppShell';
import { allDestinations } from './shell/navigation';
import ModulePlaceholder from './pages/ModulePlaceholder';
import PrimitivesHarness from './dev/PrimitivesHarness';

/**
 * Application routes.
 *
 * <p>Every ratified destination is addressable by URL (`UX-023`), registered directly from
 * the frozen navigation register so the sidebar and the router can never drift apart.
 *
 * <p>🔴 Destination pages are placeholders. No business module is implemented.
 */
export default function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/*
        DEVELOPMENT-ONLY primitive harness. 🔴 Registered only when Vite is running in dev
        mode, so it cannot exist in a production build. It is not in the navigation
        register, is not a business route, and is removable without touching any module.
      */}
      {import.meta.env.DEV && <Route path="/__dev/primitives" element={<PrimitivesHarness />} />}

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/*
          The landing route is the FIRST destination in the navigation register.

          ⚠ No canonical rule governs the post-sign-in landing destination, so this is an
          ordinary engineering choice, reported rather than hidden. It deliberately no longer
          points at an Inventory route: Inventory is not started, and the neutral first
          destination carries no business content of any kind.
        */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {allDestinations().map((destination) => (
          <Route
            key={destination.path}
            path={destination.path}
            element={<ModulePlaceholder title={destination.label} />}
          />
        ))}
      </Route>

      {/* Unknown paths fall back to the landing route rather than a fabricated 404 screen. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
