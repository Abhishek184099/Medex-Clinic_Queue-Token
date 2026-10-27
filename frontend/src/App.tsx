import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import DoctorPage, { DoctorPickerPage } from "./pages/DoctorPage";
import DisplayPage from "./pages/DisplayPage";
import ReceptionPage from "./pages/ReceptionPage";

const NAV_LINKS = [
  { to: "/reception", label: "Reception" },
  { to: "/doctor", label: "Doctor" },
  { to: "/display", label: "Waiting room" },
];

function Layout() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-2 p-3">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-sky-700 text-white" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/display" element={<DisplayPage />} />

      <Route element={<Layout />}>
        <Route index element={<Navigate to="/reception" replace />} />
        <Route path="reception" element={<ReceptionPage />} />
        <Route path="doctor" element={<DoctorPickerPage />} />
        <Route path="doctor/:doctorId" element={<DoctorPage />} />
      </Route>
    </Routes>
  );
}