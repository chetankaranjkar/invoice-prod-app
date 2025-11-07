import axios from 'axios';

const baseURL = 'https://localhost:7001/api/';

const agent = axios.create({
  baseURL,
  // Don't set default Content-Type for FormData - let browser set it
});

// Track if we're already handling a 401 to prevent multiple redirects
let isHandling401 = false;

// Activity tracker for idle timeout
let lastActivityTime = Date.now();

// Update activity timestamp on user interaction
const updateActivityTime = () => {
  lastActivityTime = Date.now();
};

// Add event listeners for user activity
if (typeof window !== 'undefined') {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    document.addEventListener(event, updateActivityTime, { passive: true });
  });
}

// Check for idle timeout
const checkIdleTimeout = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  const currentTime = Date.now();
  const idleTime = currentTime - lastActivityTime;
  const idleTimeout = 3 * 60 * 1000; // 3 minutes in milliseconds

  if (idleTime >= idleTimeout && !isHandling401) {
    console.log('⏰ Idle timeout reached');
    handleLogout();
  }
};

// Check idle timeout every 30 seconds
setInterval(checkIdleTimeout, 30000);

const handleLogout = () => {
  if (isHandling401) return;

  isHandling401 = true;
  console.log('🚫 Auto logout due to inactivity');

  localStorage.removeItem('authToken');
  localStorage.removeItem('user');

  // Only redirect if we're not already on login page
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }

  // Reset flag after a short delay
  setTimeout(() => {
    isHandling401 = false;
  }, 1000);
};

// Clean token before setting headers
const cleanToken = (token: string | null): string | null => {
  if (!token) return null;
  return token.replace(/[^\x00-\x7F]/g, '').trim();
};

// Enhanced request interceptor with FormData support
agent.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    const cleanAuthToken = cleanToken(token);

    console.log('🔐 Token from storage:', cleanAuthToken ? 'Present' : 'Missing');
    console.log('📤 Request Content-Type:', config.headers?.['Content-Type']);
    console.log('📤 Is FormData:', config.data instanceof FormData);

    if (cleanAuthToken) {
      config.headers.Authorization = `Bearer ${cleanAuthToken}`;
      console.log('✅ Authorization header set for:', config.url);

      // Update activity time on API calls
      updateActivityTime();
    } else {
      console.warn('❌ No auth token found in localStorage');
    }

    // For FormData, let the browser set the Content-Type with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      console.log('🔄 Removed Content-Type header for FormData');
    }

    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor
agent.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url);

    // Update activity time on successful API responses
    updateActivityTime();

    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.response?.data,
      headers: error.config?.headers
    });

    if (error.response?.status === 401 && !isHandling401) {
      isHandling401 = true;
      console.log('🚫 401 Unauthorized - clearing token');

      localStorage.removeItem('authToken');
      localStorage.removeItem('user');

      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }

      setTimeout(() => {
        isHandling401 = false;
      }, 1000);
    }

    return Promise.reject(error);
  }
);

export const api = {
  // Auth APIs
  auth: {
    login: (data: any) => agent.post<any>('Auth/login', data),
    register: (data: any) => agent.post<any>('Auth/register', data),
    getCurrentUser: () => agent.get<any>('Auth/me'),
  },

  // User Profile APIs - FIXED FormData handling
  user: {
    getProfile: () => agent.get<any>('User/profile'),
    updateProfile: (data: any) => agent.put<any>('User/profile', data),

    uploadLogo: (logoFile: File) => {
      const formData = new FormData();
      formData.append('logo', logoFile);

      console.log('📁 Uploading logo file:', logoFile.name, logoFile.type, logoFile.size);

      return agent.post<{ logoUrl: string }>('User/upload-logo', formData);
      // Remove headers - let browser set Content-Type with boundary
    },

    updateProfileWithLogo: (data: any, logoFile?: File) => {
      const formData = new FormData();

      // Append profile data
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value as string);
          console.log(`📝 Appending ${key}: ${value}`);
        }
      });

      // Append logo if provided
      if (logoFile) {
        formData.append('logo', logoFile);
        console.log('📁 Appending logo file:', logoFile.name);
      }

      return agent.post<any>('User/profile-with-logo', formData);
      // Remove headers - let browser set Content-Type with boundary
    },
  },

  // Customer APIs
  customers: {
    getList: () => agent.get<any[]>('Customers'),
    create: (data: any) => agent.post<any>('Customers', data),
    getById: (id: number) => agent.get<any>(`Customers/${id}`),
  },

  // Invoice APIs
  invoices: {
    getList: () => agent.get<any[]>('Invoices'),
    getById: (id: number) => agent.get<any>(`Invoices/${id}`),
    create: (data: any) => agent.post<any>('Invoices', data),
    addPayment: (id: number, data: any) => agent.post(`Invoices/${id}/payments`, data),
  },

  // Dashboard APIs
  dashboard: {
    getStats: () => agent.get<any>('Dashboard/stats'),
  },

  // Utility methods for idle timeout
  idleTimeout: {
    resetTimer: () => {
      updateActivityTime();
      console.log('🔄 Activity timer reset');
    },
    getTimeUntilTimeout: () => {
      const currentTime = Date.now();
      const idleTime = currentTime - lastActivityTime;
      const idleTimeout = 3 * 60 * 1000; // 3 minutes
      return Math.max(0, idleTimeout - idleTime);
    }
  }
};

export default agent;