
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./index.css";

import Home from "./App.jsx";
import Compiler from "./pages/Compiler.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import RoomPage from "./pages/RoomPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compiler" element={<Compiler />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/rooms/create"
          element={<RoomPage mode="create" />}
        />
        <Route
          path="/rooms/join"
          element={<RoomPage mode="join" />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
