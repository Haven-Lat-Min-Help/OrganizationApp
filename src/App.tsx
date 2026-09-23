import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireOrgUser } from './components/RequireOrgUser';
import { Branches } from './screens/Branches';
import { OrgLogin } from './screens/OrgLogin';
import { Profile } from './screens/Profile';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<OrgLogin />} />
      <Route
        path="/branches"
        element={
          <RequireOrgUser>
            <Branches />
          </RequireOrgUser>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireOrgUser>
            <Profile />
          </RequireOrgUser>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
