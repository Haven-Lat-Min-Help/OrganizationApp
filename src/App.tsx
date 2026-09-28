import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { CallScope } from './components/calls/CallScope';
import { BranchAdminOnly, OrgAdminOnly, RoleSwitch, StaffOnly } from './components/RoleRoute';
import { RequireOrgUser } from './components/RequireOrgUser';
import { BranchScope } from './context/BranchContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { AcceptInvite } from './screens/AcceptInvite';
import { AddBranch } from './screens/AddBranch';
import { AddStaff } from './screens/AddStaff';
import { BranchCallRecords } from './screens/BranchCallRecords';
import { BranchDashboard } from './screens/BranchDashboard';
import { BranchDetail } from './screens/BranchDetail';
import { BranchHome } from './screens/BranchHome';
import { BranchStaff } from './screens/BranchStaff';
import { Branches } from './screens/Branches';
import { Dashboard } from './screens/Dashboard';
import { Home } from './screens/Home';
import { OrgLogin } from './screens/OrgLogin';
import { OrgStaff } from './screens/OrgStaff';
import { Profile } from './screens/Profile';
import { StaffCalls } from './screens/StaffCalls';
import { StaffDetail } from './screens/StaffDetail';
import { StaffHome } from './screens/StaffHome';

// Dev-only stand-in caller for testing call audio before the mobile app can
// call. In a production build import.meta.env.DEV is false, so this is null
// and the page — and its bundle chunk — are left out entirely.
const DevCaller = import.meta.env.DEV ? lazy(() => import('./screens/dev/DevCaller')) : null;

function App() {
  return (
    <Routes>
      <Route path="/login" element={<OrgLogin />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      {DevCaller && (
        <Route
          path="/dev/caller"
          element={
            <Suspense fallback={null}>
              <DevCaller />
            </Suspense>
          }
        />
      )}
      {/* Everything behind login: guard first (which reads the profile role),
          then load the user's org once, and — for branch admins and staff — their branch.
          Staff also get their calling connection here, above the pages, so it
          survives moving between them. */}
      <Route
        element={
          <RequireOrgUser>
            <OrganizationProvider>
              <BranchScope>
                <CallScope>
                  <Outlet />
                </CallScope>
              </BranchScope>
            </OrganizationProvider>
          </RequireOrgUser>
        }
      >
        {/* Same path, different page per role: branch admins get their branch, staff their own
            overview, the org admin the org. Staff can reach only /home, /calls and /profile. */}
        <Route
          path="/home"
          element={<RoleSwitch branchAdmin={<BranchHome />} staff={<StaffHome />} otherwise={<Home />} />}
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/calls" element={<StaffOnly><StaffCalls /></StaffOnly>} />
        <Route path="/branches" element={<OrgAdminOnly><Branches /></OrgAdminOnly>} />
        <Route path="/branches/new" element={<OrgAdminOnly><AddBranch /></OrgAdminOnly>} />
        <Route path="/branches/:id" element={<OrgAdminOnly><BranchDetail /></OrgAdminOnly>} />
        {/* Staff tab: the branch admin manages their branch's staff, the org admin sees
            every branch's (read-only). Staff themselves have no staff list. */}
        <Route
          path="/staff"
          element={
            <RoleSwitch
              branchAdmin={<BranchStaff />}
              staff={<Navigate to="/home" replace />}
              otherwise={<OrgAdminOnly><OrgStaff /></OrgAdminOnly>}
            />
          }
        />
        <Route path="/staff/new" element={<BranchAdminOnly><AddStaff /></BranchAdminOnly>} />
        <Route path="/staff/:id" element={<BranchAdminOnly><StaffDetail /></BranchAdminOnly>} />
        <Route path="/call-records" element={<BranchAdminOnly><BranchCallRecords /></BranchAdminOnly>} />
        <Route
          path="/dashboard"
          element={
            <RoleSwitch
              branchAdmin={<BranchDashboard />}
              staff={<Navigate to="/home" replace />}
              otherwise={<OrgAdminOnly><Dashboard /></OrgAdminOnly>}
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
