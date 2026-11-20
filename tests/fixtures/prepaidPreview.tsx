import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppShell from "../../src/components/AppShell";
import PrepaidRoute from "../../src/routes/PrepaidRoute";
import "../../src/styles.css";
const screen = new URLSearchParams(location.search).get("screen");
createRoot(document.getElementById("root")!).render(
  <MemoryRouter
    initialEntries={[
      screen === "upload" ? "/prepaid/file-upload" : "/prepaid/eg-layout",
    ]}
  >
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/prepaid/:section" element={<PrepaidRoute />} />
        <Route
          path="/prepaid/:section/:region/:variant"
          element={<PrepaidRoute />}
        />
      </Route>
    </Routes>
  </MemoryRouter>,
);
