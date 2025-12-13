import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const API_URL = "https://oldschool-messanger-backend.onrender.com";

function Login() {
  const navigate = useNavigate();

  // Username/password login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // OTP login
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState("enter-phone");
  const [otpInfo, setOtpInfo] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Username + password login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await axios.post(`${API_URL}/login`, {
        username,
        password,
      });

      const { token, userId, username: uname } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("userId", userId);
      localStorage.setItem("username", uname);

      navigate("/chat");
    } catch (err) {
      setLoginError(
        err.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpInfo("");
    setOtpLoading(true);

    try {
      const res = await axios.post(`${API_URL}/auth/request-otp`, {
        phoneNumber: phoneNumber.trim(),
      });

      setOtpStep("enter-code");
      setOtpInfo("OTP generated (dev mode). Check backend logs.");
    } catch (err) {
      setOtpError(
        err.response?.data?.message || "Could not request OTP."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpInfo("");
    setOtpLoading(true);

    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, {
        phoneNumber: phoneNumber.trim(),
        code: otpCode.trim(),
      });

      const { token, userId, username: uname } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("userId", userId);
      localStorage.setItem("username", uname);

      navigate("/chat");
    } catch (err) {
      setOtpError(
        err.response?.data?.message || "OTP verification failed."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const resetOtpFlow = () => {
    setOtpStep("enter-phone");
    setOtpCode("");
    setOtpError("");
    setOtpInfo("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-title">Galiyoon</div>
          <div className="auth-subtitle">simple, quiet chat</div>
        </div>

        {/* Username + password */}
        <form onSubmit={handlePasswordLogin} className="auth-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {loginError && <div className="auth-error">{loginError}</div>}

          <button type="submit" className="auth-primary-btn" disabled={loginLoading}>
            {loginLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="chats-label" style={{ margin: "10px 0" }}>
          OR
        </div>

        {/* OTP login */}
        {otpStep === "enter-phone" && (
          <form onSubmit={handleRequestOtp} className="auth-form">
            <input
              type="tel"
              placeholder="Phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />

            {otpError && <div className="auth-error">{otpError}</div>}
            {otpInfo && <div className="auth-success">{otpInfo}</div>}

            <button type="submit" className="auth-primary-btn" disabled={otpLoading}>
              {otpLoading ? "Requesting OTP..." : "Request OTP"}
            </button>
          </form>
        )}

        {otpStep === "enter-code" && (
          <form onSubmit={handleVerifyOtp} className="auth-form">
            <input type="tel" value={phoneNumber} disabled />
            <input
              type="text"
              placeholder="OTP code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />

            {otpError && <div className="auth-error">{otpError}</div>}
            {otpInfo && <div className="auth-success">{otpInfo}</div>}

            <button type="submit" className="auth-primary-btn" disabled={otpLoading}>
              {otpLoading ? "Verifying..." : "Verify & Login"}
            </button>

            <button
              type="button"
              className="auth-secondary-btn"
              onClick={resetOtpFlow}
            >
              Change phone
            </button>
          </form>
        )}

        {/* ✅ SIGNUP LINK */}
        <div className="auth-switch">
          <span className="auth-switch-text">Don’t have an account?</span>
          <Link to="/signup" className="auth-secondary-btn">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
