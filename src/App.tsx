import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { UploadModeProvider } from "./lib/uploadMode";
import AprmRoute from "./routes/AprmRoute";
import DashboardRoute from "./routes/DashboardRoute";
import MemoRoute from "./routes/MemoRoute";
import PrepaidRoute from "./routes/PrepaidRoute";

export default function App() {
  return (
    <UploadModeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/prepaid" element={<PrepaidRoute />} />
          <Route path="/memo" element={<MemoRoute />} />
          <Route path="/aprm" element={<AprmRoute />} />
        </Route>
      </Routes>
    </UploadModeProvider>
  );
}
