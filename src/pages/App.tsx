import { Fragment, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Container } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { emptyAddresses } from "../store/addressSlice";

// Context Provider
import { LocationProvider } from "../components/contexts/LocationContext";

// Layout
import MainNavigation from "../components/layout/MainNavigation";

// Pages
import Home from "./Home";
import Form from "./Form";
import Results from "./Results";
import NotFound from "./NotFound";
import Login from "./login";
import History from "./History";
import Register from "./Register";
import AdminDashboard from "./AdminDashboard";
import CallsPage from "./CallsPage";
import CallHistory from "./CallHistory";
import LiveMap from "./LiveMap";
import ReportsPage from "./ReportsPage";

// 📍 Global Location Tracker Component
import GlobalLocationTracker from "../components/tracking/GlobalLocationTracker";

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [token, setToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken || !storedUser) {
      localStorage.clear();
      setToken(null);
      setUserRole(null);
    } else {
      try {
        const parsed = JSON.parse(storedUser);
        setToken(storedToken);
        setUserRole(parsed?.role || null);
      } catch {
        localStorage.clear();
        setToken(null);
        setUserRole(null);
      }
    }

    const handleStorageChange = () => {
      const updatedToken = localStorage.getItem("token");
      const updatedUser = localStorage.getItem("user");

      if (!updatedToken || !updatedUser) {
        setToken(null);
        setUserRole(null);
        navigate("/login");
      } else {
        const parsed = JSON.parse(updatedUser);
        setToken(updatedToken);
        setUserRole(parsed?.role || null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [location.pathname]);

  const isAuthPage = ["/", "/login", "/register"].includes(location.pathname);

  const handleLogout = () => {
    localStorage.clear();
    dispatch(emptyAddresses());
    setToken(null);
    setUserRole(null);
    navigate("/login");
  };

  return (
    <Fragment>
      {/* 🌍 Location Provider - Wraps the entire app for global location state */}
      <LocationProvider>
        {/* 🌍 Global location tracker for all authenticated users across all pages */}
        {token && <GlobalLocationTracker />}

        {!isAuthPage && <MainNavigation onLogout={handleLogout} />}

        <main className={!isAuthPage ? "pt-5 mt-5" : ""}>
          <Container>
            <Routes>
              {/* Public Routes */}
              <Route
                path="/"
                element={token && userRole ? <Navigate to="/home" /> : <Login />}
              />
              <Route
                path="/login"
                element={token && userRole ? <Navigate to="/home" /> : <Login />}
              />
              <Route path="/register" element={<Register />} />

              {/* Authenticated User Routes */}
              <Route
                path="/home"
                element={token ? <Home /> : <Navigate to="/login" />}
              />
              <Route
                path="/form"
                element={token ? <Form /> : <Navigate to="/login" />}
              />
              <Route
                path="/result"
                element={token ? <Results /> : <Navigate to="/login" />}
              />
              <Route
                path="/history"
                element={token ? <History /> : <Navigate to="/login" />}
              />
              <Route
                path="/calls"
                element={token ? <CallsPage /> : <Navigate to="/login" />}
              />
              <Route
                path="/call-history"
                element={token ? <CallHistory /> : <Navigate to="/login" />}
              />

              {/* Admin-only Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  token && userRole === "admin" ? (
                    <AdminDashboard />
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/admin/live-map"
                element={
                  token && userRole === "admin" ? (
                    <LiveMap />
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/admin/reports"
                element={
                  token && userRole === "admin" ? (
                    <ReportsPage />
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Container>
        </main>
      </LocationProvider>
    </Fragment>
  );
};

export default App;