import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const API_URL = "https://oldschool-messanger-backend.onrender.com";
const PHONE_REGEX = /^[0-9]{8,15}$/;

function Signup() {
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim() || !phoneNumber.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }

    if (!PHONE_REGEX.test(phoneNumber.trim())) {
      setError("Enter a valid phone number");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/signup`, {
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });

      setSuccess(res.data.message || "Signup successful");
      setTimeout(() => navigate("/"), 900);
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-title">Join Galiyoon</div>
          <div className="auth-subtitle">simple, quiet chat</div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          <input
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <button type="submit" className="auth-primary-btn">
            Sign up
          </button>
        </form>

        <div className="auth-switch">
          <span className="auth-switch-text">Already have an account?</span>
          <Link to="/" className="auth-secondary-btn">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
