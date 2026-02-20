import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refreshToken'));

  // Configure axios defaults and interceptor
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Axios interceptor for 401 - attempt token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          refreshToken &&
          !originalRequest.url?.includes('/api/auth/refresh') &&
          !originalRequest.url?.includes('/api/auth/login')
        ) {
          originalRequest._retry = true;

          try {
            const response = await axios.post(
              `${API_URL}/api/auth/refresh`,
              {},
              {
                headers: { Authorization: `Bearer ${refreshToken}` },
              }
            );

            const { access_token, refresh_token: newRefreshToken } = response.data;
            localStorage.setItem('token', access_token);
            localStorage.setItem('refreshToken', newRefreshToken);
            setToken(access_token);
            setRefreshToken(newRefreshToken);

            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Refresh failed - log out
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            setToken(null);
            setRefreshToken(null);
            setUser(null);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshToken]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/auth/me`);
        setUser(response.data);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setRefreshToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [token]);

  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });

    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    if (refresh_token) {
      localStorage.setItem('refreshToken', refresh_token);
      setRefreshToken(refresh_token);
    }
    setToken(access_token);
    setUser(userData);

    return userData;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      name,
      email,
      password
    });

    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    if (refresh_token) {
      localStorage.setItem('refreshToken', refresh_token);
      setRefreshToken(refresh_token);
    }
    setToken(access_token);
    setUser(userData);

    return userData;
  }, []);

  const loginWithGitHub = useCallback(async (code) => {
    const response = await axios.post(`${API_URL}/api/auth/oauth/github/callback`, {
      code
    });

    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    if (refresh_token) {
      localStorage.setItem('refreshToken', refresh_token);
      setRefreshToken(refresh_token);
    }
    setToken(access_token);
    setUser(userData);

    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`);
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const response = await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
    return response.data;
  }, []);

  const resetPassword = useCallback(async (resetToken, newPassword) => {
    const response = await axios.post(`${API_URL}/api/auth/reset-password`, {
      token: resetToken,
      new_password: newPassword,
    });
    return response.data;
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    loginWithGitHub,
    logout,
    forgotPassword,
    resetPassword,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
