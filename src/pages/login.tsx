import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import axios from "axios";
import "./login.scss";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      const { token, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("role", user.role); // ✅ Store role
        setSuccess(true);

        // ✅ Redirect based on role
        setTimeout(() => {
          if (user.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/form"); // Change this to /home if needed
          }
        }, 1000);
      } else {
        setError("No token received. Please try again.");
      }
    } catch (err: any) {
      setError(err.response?.data?.msg || "Login failed. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="branding">TripTeller</div>

      <div className="login-wrapper">
        <div className="login-left">
          <h3 className="mb-4 text-center">Sign In</h3>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">Login successful! Redirecting...</Alert>}

          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="custom-input"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="custom-input"
              />
            </Form.Group>

            <Button type="submit" className="btn-login w-100 mb-3">
              Sign In
            </Button>
          </Form>
        </div>

        <div className="login-right">
          <h2>Welcome to login</h2>
          <p>Don't have an account?</p>
          <Button
            variant="light"
            onClick={() => navigate("/register")}
            className="signup-btn"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
