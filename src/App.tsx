import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import AppShell from "./components/AppShell";
import AprmRoute from "./routes/AprmRoute";
import DashboardRoute from "./routes/DashboardRoute";
import MemoRoute from "./routes/MemoRoute";
import PrepaidRoute from "./routes/PrepaidRoute";
import ChangePasswordRoute from "./routes/ChangePasswordRoute";
import LoginRoute from "./routes/LoginRoute";
import AdminUsersRoute from "./routes/AdminUsersRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/change-password" element={<RequireAuth><ChangePasswordRoute /></RequireAuth>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/prepaid" element={<Navigate to="/prepaid/file-upload" replace />} />
        <Route path="/prepaid/:section" element={<PrepaidRoute />} />
        <Route path="/prepaid/:section/:region/:variant" element={<PrepaidRoute />} />
        <Route path="/memo" element={<Navigate to="/memo/file-upload" replace />} />
        <Route path="/memo/:section" element={<MemoRoute />} />
        <Route path="/aprm" element={<AprmRoute />} />
        <Route path="/aprm/:area" element={<AprmRoute />} />
        <Route path="/admin/users" element={<AdminUsersRoute />} />
      </Route>
    </Routes>
  );
}
