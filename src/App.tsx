import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BranchAdminOnly, OrgAdminOnly, RoleSwitch } from './components/RoleRoute';
import { RequireOrgUser } from './components/RequireOrgUser';
import { BranchScope } from './context/BranchContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { AcceptInvite } from './screens/AcceptInvite';
import { AddBranch } from './screens/AddBranch';
import { AddStaff } from './screens/AddStaff';
import { BranchDashboard } from './screens/BranchDashboard';
import { BranchDetail } from './screens/BranchDetail';
import { BranchHome } from './screens/BranchHome';
import { BranchStaff } from './screens/BranchStaff';
import { Branches } from './screens/Branches';
import { Home } from './screens/Home';
import { OrgLogin } from './screens/OrgLogin';
import { Profile } from './screens/Profile';
import { StaffDetail } from './screens/StaffDetail';
import { StaffHome } from './screens/StaffHome';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<OrgLogin />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      {/* Everything behind login: guard first (which reads the profile role),
          then load the user's org once, and — for branch admins and staff — their branch. */}
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
        {/* Same path, different page per role: branch admins get their branch, staff their own
            overview, the org admin the org. Staff can reach only /home and /profile. */}
        <Route
          path="/home"
          element={<RoleSwitch branchAdmin={<BranchHome />} staff={<StaffHome />} otherwise={<Home />} />}
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/branches" element={<OrgAdminOnly><Branches /></OrgAdminOnly>} />
        <Route path="/branches/new" element={<OrgAdminOnly><AddBranch /></OrgAdminOnly>} />
        <Route path="/branches/:id" element={<OrgAdminOnly><BranchDetail /></OrgAdminOnly>} />
        <Route path="/staff" element={<BranchAdminOnly><BranchStaff /></BranchAdminOnly>} />
        <Route path="/staff/new" element={<BranchAdminOnly><AddStaff /></BranchAdminOnly>} />
        <Route path="/staff/:id" element={<BranchAdminOnly><StaffDetail /></BranchAdminOnly>} />
        <Route path="/dashboard" element={<BranchAdminOnly><BranchDashboard /></BranchAdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
