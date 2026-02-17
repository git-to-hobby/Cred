/**
 * API Configuration
 * Centralized configuration for all backend API endpoints
 */

// API Base URLs - Update these based on your environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const CRM_SERVICE_URL = import.meta.env.VITE_CRM_SERVICE_URL || 'http://127.0.0.1:9001';
const DOC_PROCESSOR_URL = import.meta.env.VITE_DOC_PROCESSOR_URL || 'http://127.0.0.1:8005';

export const API_ENDPOINTS = {
  // Master Agent (Main Chat API)
  CHAT: `${API_BASE_URL}/chat`,
  RESET_CHAT: (customerId: string) => `${API_BASE_URL}/reset/${customerId}`,
  
  // Admin/Customer APIs
  ADMIN_CUSTOMERS: `${API_BASE_URL}/admin/customers`,
  ADMIN_CUSTOMER: (custId: string) => `${API_BASE_URL}/admin/customer/${custId}`,
  CUSTOMER_PROFILE: (custId: string) => `${API_BASE_URL}/customer/${custId}/profile`,
  CUSTOMER_DETAIL: (custId: string) => `${API_BASE_URL}/customer/${custId}`,
  ADMIN_CHAT: (custId: string) => `${API_BASE_URL}/admin/chat/${custId}`,
  ADMIN_LOAN_DECISION: (loanId: number) => `${API_BASE_URL}/admin/loans/${loanId}/decision`,
  ADMIN_MONITOR_OVERVIEW: `${API_BASE_URL}/admin/monitor/overview`,
  ADMIN_MONITOR_AUDIT: `${API_BASE_URL}/admin/monitor/audit`,
  ADMIN_MONITOR_BANKERS: `${API_BASE_URL}/admin/monitor/bankers`,
  ADMIN_MONITOR_BANKER: (bankerId: string) => `${API_BASE_URL}/admin/monitor/bankers/${bankerId}`,
  ADMIN_MONITOR_BANKER_APPROVE: (bankerId: string) =>
    `${API_BASE_URL}/admin/monitor/bankers/${bankerId}/approve`,
  ADMIN_MONITOR_BANKER_REJECT: (bankerId: string) =>
    `${API_BASE_URL}/admin/monitor/bankers/${bankerId}/reject`,
  
  // Auth via master agent (CRM optional on Render free tier)
  CRM_LOGIN: `${API_BASE_URL}/login`,
  ADMIN_LOGIN: `${API_BASE_URL}/admin/login`,
  ADMIN_LOGIN_VERIFY_OTP: `${API_BASE_URL}/admin/login/verify-otp`,
  FORGOT_CUSTOMER_ID_EMAIL: `${API_BASE_URL}/forgot/customer-id/email`,
  FORGOT_CUSTOMER_ID_PHONE: `${API_BASE_URL}/forgot/customer-id/phone`,
  FORGOT_PASSWORD_REQUEST: `${API_BASE_URL}/forgot/password/request`,
  FORGOT_PASSWORD_RESET: `${API_BASE_URL}/forgot/password/reset`,
  FORGOT_PASSWORD_PHONE: `${API_BASE_URL}/forgot/password/phone`,
  REGISTER: `${API_BASE_URL}/register`,
  CRM_REGISTER: `${CRM_SERVICE_URL}/register`,
  CRM_GET_CUSTOMER: (customerId: string) => `${CRM_SERVICE_URL}/crm/${customerId}`,
  
  // Document Processor
  DOC_VERIFY_SALARY: `${DOC_PROCESSOR_URL}/verify_salary_upload`,
  DOC_PROCESS_KYC: `${DOC_PROCESSOR_URL}/process_kyc_doc`,

  // Customer downloads
  SANCTION_LETTER: (custId: string, loanId: number) =>
    `${API_BASE_URL}/customer/${custId}/loans/${loanId}/sanction-letter`,
  LOAN_STATEMENT: (custId: string, loanId: number) =>
    `${API_BASE_URL}/customer/${custId}/loans/${loanId}/statement`,

  // Document verification (via master agent)
  VERIFY_SALARY: (custId: string) =>
    `${API_BASE_URL}/customer/${custId}/verify/salary-slip`,
  VERIFY_BANK_STATEMENT: (custId: string) =>
    `${API_BASE_URL}/customer/${custId}/verify/bank-statement`,
  VERIFY_KYC: (custId: string) =>
    `${API_BASE_URL}/customer/${custId}/verify/kyc`,
  VERIFY_KYC_DOCUMENT: (custId: string) =>
    `${API_BASE_URL}/customer/${custId}/verify/kyc-document`,
} as const;

/**
 * Default fetch options
 */
export const defaultFetchOptions: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'omit',
};

/**
 * Create fetch options with custom headers
 */
export function createFetchOptions(options: RequestInit = {}): RequestInit {
  return {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...options.headers,
    },
  };
}

