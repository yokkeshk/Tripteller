import { useEffect, useState } from "react";
import { Container, Navbar, Nav, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import "./mainnavigation.scss";

const MainNavigation = ({ onLogout }: { onLogout: () => void }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setRole(parsed.role);
      } catch (err) {
        console.error("Error parsing stored user:", err);
        setRole(null);
      }
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Navbar
      expand="lg"
      fixed="top"
      className={`custom-navbar ${role === "admin" ? "admin-navbar" : "user-navbar"} ${
        scrolled ? "scrolled" : ""
      }`}
    >
      <Container>
        <Link to="/" className="navbar-brand">
          TripTeller
        </Link>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {/* Shared Links */}
            <Link to="/home" className="nav-link">
              Home
            </Link>
            <Link to="/form" className="nav-link">
              Form
            </Link>
            <Link to="/result" className="nav-link">
              Result
            </Link>
            <Link to="/history" className="nav-link">
              History
            </Link>
            <Link to="/calls" className="nav-link">
              Calls
            </Link>
            <Link to="/call-history" className="nav-link">
              <i className="bi bi-clock-history me-1"></i> My Call History
            </Link>

            {/* Admin-Only Links */}
            {role === "admin" && (
              <>
                <Link to="/admin/dashboard" className="nav-link">
                  <i className="bi bi-shield-lock-fill me-1"></i> Dashboard
                </Link>
                <Link to="/admin/live-map" className="nav-link">
                  <i className="bi bi-geo-alt-fill me-1"></i> Live Map
                </Link>
                <Link to="/admin/reports" className="nav-link">
                  <i className="bi bi-file-earmark-text me-1"></i> Reports
                </Link>
              </>
            )}
          </Nav>

          <Button className="logout-btn" onClick={onLogout}>
            Logout
          </Button>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default MainNavigation;