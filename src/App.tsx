import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { RequireOrgUser } from './components/RequireOrgUser';
import { OrganizationProvider } from './context/OrganizationContext';
import { AcceptInvite } from './screens/AcceptInvite';
import { Home } from './screens/Home';
import { OrgLogin } from './screens/OrgLogin';
import { Profile } from './screens/Profile';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<OrgLogin />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      {/* Everything behind login: guard first, then load the user's org once. */}
      <Route
        element={
          <RequireOrgUser>
            <OrganizationProvider>
              <Outlet />
            </OrganizationProvider>
          </RequireOrgUser>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
