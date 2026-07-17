import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AprmRoute from "./routes/AprmRoute";
import DashboardRoute from "./routes/DashboardRoute";
import MemoRoute from "./routes/MemoRoute";
import PrepaidRoute from "./routes/PrepaidRoute";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/prepaid" element={<Navigate to="/prepaid/file-upload" replace />} />
        <Route path="/prepaid/:section" element={<PrepaidRoute />} />
        <Route path="/prepaid/:section/:region/:variant" element={<PrepaidRoute />} />
        <Route path="/memo" element={<Navigate to="/memo/file-upload" replace />} />
        <Route path="/memo/:section" element={<MemoRoute />} />
        <Route path="/aprm" element={<AprmRoute />} />
        <Route path="/aprm/:area" element={<AprmRoute />} />
      </Route>
    </Routes>
  );
}
