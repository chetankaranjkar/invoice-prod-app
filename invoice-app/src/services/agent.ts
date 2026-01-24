import axios from 'axios';

// Use environment variable for API URL, fallback to proxy or direct connection
// In development, use Vite proxy (/api/) which forwards to http://localhost:5001
// This avoids CORS issues
const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/' : '/api/');
const baseURL = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;

// Log API URL in development for debugging
if (import.meta.env.DEV) {
  console.log('🔗 API Base URL:', baseURL);
  console.log('🔗 Using Vite proxy to forward /api/ requests to http://localhost:5001');
}

const agent = axios.create({
  baseURL,
  timeout: 60000, // 60 seconds timeout for API calls
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
};

// Check for idle timeout
const checkIdleTimeout = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  const currentTime = Date.now();
  const idleTime = currentTime - lastActivityTime;
  const idleTimeout = 30 * 60 * 1000; // Increased to 30 minutes

  if (idleTime >= idleTimeout && !isHandling401) {
    handleLogout();
  }
}

// Check idle timeout every 90 seconds
setInterval(checkIdleTimeout, 90000);

const handleLogout = () => {
  if (isHandling401) return;

  isHandling401 = true;
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

    if (cleanAuthToken) {
      config.headers.Authorization = `Bearer ${cleanAuthToken}`;
      // Update activity time on API calls
      updateActivityTime();
    }

    // For FormData, let the browser set the Content-Type with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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
    // Update activity time on successful API responses
    updateActivityTime();
    return response;
  },
  (error) => {
    // Enhanced error logging
    if (import.meta.env.DEV) {
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config?.url,
        message: error.response?.data?.message || error.response?.data || error.message,
        data: error.response?.data,
        code: error.code,
        isNetworkError: !error.response,
        networkError: error.message,
      };
      console.error('❌ API Error:', errorDetails);
      
      // Show helpful message for common issues
      if (!error.response) {
        console.error('💡 Network Error - Possible causes:');
        console.error('   1. API server is not running');
        console.error('   2. Wrong API URL (check VITE_API_URL or baseURL)');
        console.error('   3. CORS issue (check backend CORS settings)');
        console.error('   4. Firewall blocking the connection');
        console.error(`   Current API URL: ${error.config?.baseURL || 'not set'}`);
      }
    } else {
      // In production, only log status and URL (no sensitive data)
      console.error('❌ API Error:', error.response?.status, error.config?.url);
    }

    // Don't logout for network errors or server errors other than 401
    if (error.response?.status === 401 && !isHandling401) {
      isHandling401 = true;
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
      return agent.post<{ logoUrl: string }>('User/upload-logo', formData);
      // Remove headers - let browser set Content-Type with boundary
    },

    updateProfileWithLogo: (data: any, logoFile?: File) => {
      const formData = new FormData();

      // Helper function to convert camelCase to PascalCase
      const toPascalCase = (str: string): string => {
        // If already PascalCase (starts with uppercase), return as is
        if (str[0] === str[0].toUpperCase()) return str;
        // Convert camelCase to PascalCase
        return str.charAt(0).toUpperCase() + str.slice(1);
      };

      // Append profile data
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Convert camelCase property names to PascalCase to match backend DTO
          const propertyName = toPascalCase(key);

          // Convert value to string properly
          let stringValue: string;
          if (typeof value === 'boolean') {
            stringValue = value.toString();
          } else if (typeof value === 'number') {
            stringValue = value.toString();
          } else {
            stringValue = value as string;
          }

          formData.append(propertyName, stringValue);
        }
      });

      // Append logo if provided
      if (logoFile) {
        formData.append('logo', logoFile);
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
    update: (id: number, data: any) => agent.put<any>(`Customers/${id}`, data),
    delete: (id: number) => agent.delete<any>(`Customers/${id}`),
  },

  // Invoice APIs
  invoices: {
    getList: () => agent.get<any[]>('Invoices'),
    getById: (id: number) => agent.get<any>(`Invoices/${id}`),
    create: (data: any) => agent.post<any>('Invoices', data),
    update: (id: number, data: any) => agent.put<any>(`Invoices/${id}`, data),
    delete: (id: number) => agent.delete<any>(`Invoices/${id}`),
    duplicate: (id: number) => agent.post<any>(`Invoices/${id}/duplicate`, {}),
    addPayment: (id: number, data: any) => agent.post(`Invoices/${id}/payments`, data),
  },

  // Invoice Template APIs
  invoiceTemplates: {
    getList: () => agent.get<any[]>('InvoiceTemplate'),
    getById: (id: number) => agent.get<any>(`InvoiceTemplate/${id}`),
    create: (data: any) => agent.post<any>('InvoiceTemplate', data),
    update: (id: number, data: any) => agent.put<any>(`InvoiceTemplate/${id}`, data),
    delete: (id: number) => agent.delete<any>(`InvoiceTemplate/${id}`),
  },

  // Recurring Invoice APIs
  recurringInvoices: {
    getList: () => agent.get<any[]>('RecurringInvoice'),
    getById: (id: number) => agent.get<any>(`RecurringInvoice/${id}`),
    create: (data: any) => agent.post<any>('RecurringInvoice', data),
    update: (id: number, data: any) => agent.put<any>(`RecurringInvoice/${id}`, data),
    delete: (id: number) => agent.delete<any>(`RecurringInvoice/${id}`),
    generate: (id: number) => agent.post<any>(`RecurringInvoice/${id}/generate`, {}),
    generateAll: () => agent.post<any>('RecurringInvoice/generate-all', {}),
  },

  auditLogs: {
    getAll: (params?: any) => agent.get<any>('AuditLog', { params }),
  },

  // Dashboard APIs
  dashboard: {
    getStats: () => agent.get<any>('Dashboard/stats'),
  },

  // User Management APIs (Admin only)
  userManagement: {
    getAllUsers: () => agent.get<any[]>('UserManagement/users'),
    createUser: (data: any) => agent.post<any>('UserManagement/users', data),
    updateUser: (userId: string, data: any) => agent.put<any>(`UserManagement/users/${userId}`, data),
    deleteUser: (userId: string) => agent.delete<any>(`UserManagement/users/${userId}`),
    getUserById: (userId: string) => agent.get<any>(`UserManagement/users/${userId}`),
  },

  // Backup APIs (Admin/MasterUser only)
  backup: {
    create: () => agent.post('Backup/create', {}, { responseType: 'blob' }),
    restore: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return agent.post('Backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    list: () => agent.get<any[]>('Backup/list'),
  },

  // Error Log APIs (Admin/MasterUser only)
  errorLogs: {
    getAll: (page?: number, pageSize?: number) => agent.get<any[]>('ErrorLog', { params: { page, pageSize } }),
    getUnresolved: () => agent.get<any[]>('ErrorLog/unresolved'),
    getById: (id: number) => agent.get<any>(`ErrorLog/${id}`),
    getStats: () => agent.get<any>('ErrorLog/stats'),
    markResolved: (id: number, resolutionNotes?: string) => agent.post(`ErrorLog/${id}/resolve`, { resolutionNotes }),
  },

  // Utility methods for idle timeout
  idleTimeout: {
    resetTimer: () => {
      updateActivityTime();
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