/**
 * Authentication API Service
 * Handles login, registration, and customer data retrieval
 */

import { post, get } from './client';
import { API_ENDPOINTS } from './config';

export interface LoginRequest {
  custId: string;
  password: string;
}

export interface LoginResponse {
  status: string;
  name: string;
  custId: string;
  credit_score: number;
}

export interface RegisterRequest {
  name: string;
  age: string;
  city: string;
  phone: string;
  address: string;
  aadhar: string;
  password: string;
}

export interface RegisterResponse {
  status: string;
  custId: string;
}

export interface CustomerKYC {
  custId: string;
  name: string;
  age: number;
  phone: string;
  address: string;
  aadhaar: string;
  credit_score: number | null;
  category: string | null;
}

/**
 * Login user
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>(API_ENDPOINTS.CRM_LOGIN, credentials);
}

export async function forgotCustomerIdByEmail(email: string) {
  return post<{ success: boolean; message: string }>(
    API_ENDPOINTS.FORGOT_CUSTOMER_ID_EMAIL,
    { email: email.trim() }
  );
}

export async function forgotCustomerIdByPhone(phone: string, aadhaarLast4: string) {
  return post<{ success: boolean; custId: string; name: string; message: string }>(
    API_ENDPOINTS.FORGOT_CUSTOMER_ID_PHONE,
    { phone: phone.trim(), aadhaarLast4: aadhaarLast4.trim() }
  );
}

export async function requestPasswordReset(custId: string, email: string) {
  return post<{ success: boolean; otpSessionId: string; message: string }>(
    API_ENDPOINTS.FORGOT_PASSWORD_REQUEST,
    { custId: custId.trim(), email: email.trim() }
  );
}

export async function resetPasswordWithOtp(data: {
  otpSessionId: string;
  custId: string;
  email: string;
  otp: string;
  newPassword: string;
}) {
  return post<{ success: boolean; message: string }>(
    API_ENDPOINTS.FORGOT_PASSWORD_RESET,
    data
  );
}

export async function resetPasswordByPhone(data: {
  custId: string;
  phone: string;
  aadhaarLast4: string;
  newPassword: string;
}) {
  return post<{ success: boolean; message: string }>(
    API_ENDPOINTS.FORGOT_PASSWORD_PHONE,
    data
  );
}

/**
 * Register new user
 */
export async function register(
  userData: RegisterRequest
): Promise<RegisterResponse> {
  return post<RegisterResponse>(API_ENDPOINTS.CRM_REGISTER, userData);
}

/**
 * Get customer KYC data
 */
export async function getCustomerKYC(
  customerId: string
): Promise<CustomerKYC> {
  return get<CustomerKYC>(API_ENDPOINTS.CRM_GET_CUSTOMER(customerId));
}

