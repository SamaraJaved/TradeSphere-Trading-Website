import { Route, Routes } from "react-router";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Trade from "./pages/Trade";
import Market from "./pages/Market";
import Portfolio from "./pages/Portfolio";
import History from "./pages/History";
import Profile from "./pages/Profile";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/trade/:symbol" element={<Trade />} />
      <Route path="/market" element={<Market />} />
      <Route path="/portfolio" element={<Portfolio />} />
      <Route path="/history" element={<History />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

export default App;