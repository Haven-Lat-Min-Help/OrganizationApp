import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BranchAdminOnly, OrgAdminOnly, RoleSwitch } from './components/RoleRoute';
import { RequireOrgUser } from './components/RequireOrgUser';
import { BranchScope } from './context/BranchContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { AcceptInvite } from './screens/AcceptInvite';
import { AddBranch } from './screens/AddBranch';
import { BranchDashboard } from './screens/BranchDashboard';
import { BranchDetail } from './screens/BranchDetail';
import { BranchHome } from './screens/BranchHome';
import { BranchStaff } from './screens/BranchStaff';
import { Branches } from './screens/Branches';
import { Home } from './screens/Home';
import { OrgLogin } from './screens/OrgLogin';
import { Profile } from './screens/Profile';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<OrgLogin />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      {/* Everything behind login: guard first (which reads the profile role),
          then load the user's org once, and — for branch admins only — their branch. */}
      <Route
        element={
          <RequireOrgUser>
            <OrganizationProvider>
              <BranchScope>
                <Outlet />
              </BranchScope>
            </OrganizationProvider>
          </RequireOrgUser>
        }
      >
        {/* Same path, different page per role: branch admins get their branch, everyone else the org. */}
        <Route path="/home" element={<RoleSwitch branchAdmin={<BranchHome />} otherwise={<Home />} />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/branches" element={<OrgAdminOnly><Branches /></OrgAdminOnly>} />
        <Route path="/branches/new" element={<OrgAdminOnly><AddBranch /></OrgAdminOnly>} />
        <Route path="/branches/:id" element={<OrgAdminOnly><BranchDetail /></OrgAdminOnly>} />
        <Route path="/staff" element={<BranchAdminOnly><BranchStaff /></BranchAdminOnly>} />
        <Route path="/dashboard" element={<BranchAdminOnly><BranchDashboard /></BranchAdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
