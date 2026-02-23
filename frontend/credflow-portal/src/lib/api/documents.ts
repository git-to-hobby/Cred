/**
 * Document API Service
 * Handles document uploads and verification via master agent
 */

import { post, postFormData } from './client';
import { API_ENDPOINTS } from './config';

export interface SalaryVerificationResponse {
  status: 'verified' | 'manual_review' | 'failed';
  monthly_salary: number | null;
  salary_source: string | null;
  document_type: string | null;
  confidence: number | null;
  file_path?: string;
  message?: string;
  error?: string;
}

export interface BankStatementResponse {
  status: string;
  score?: number;
  file_path?: string;
  message?: string;
  insights?: Record<string, unknown>;
  filename?: string;
}

export interface KycVerificationResponse {
  status: string;
  kyc_status: string;
  name?: string;
  aadhaar?: string;
  pan?: string;
  file_path?: string;
  message?: string;
}

/**
 * Upload and verify salary document
 */
export async function verifySalaryDocument(
  customerId: string,
  file: File
): Promise<SalaryVerificationResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return postFormData<SalaryVerificationResponse>(
    API_ENDPOINTS.VERIFY_SALARY(customerId),
    formData
  );
}

/**
 * Upload and analyze bank statement
 */
export async function verifyBankStatement(
  customerId: string,
  file: File
): Promise<BankStatementResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return postFormData<BankStatementResponse>(
    API_ENDPOINTS.VERIFY_BANK_STATEMENT(customerId),
    formData
  );
}

/**
 * Trigger KYC verification from profile
 */
export async function verifyKyc(customerId: string): Promise<KycVerificationResponse> {
  return post<KycVerificationResponse>(API_ENDPOINTS.VERIFY_KYC(customerId));
}

/**
 * Upload KYC document (Aadhaar/PAN)
 */
export async function verifyKycDocument(
  customerId: string,
  file: File
): Promise<KycVerificationResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return postFormData<KycVerificationResponse>(
    API_ENDPOINTS.VERIFY_KYC_DOCUMENT(customerId),
    formData
  );
}
