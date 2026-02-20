/**
 * Customer API Service
 * Handles customer data and loan information
 */

import { get, put } from './client';
import { API_ENDPOINTS } from './config';

export interface Customer {
  cust_id: string;
  name: string;
  email?: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  credit_score: number;
  pre_approved_limit: number;
  interest_options: string[];
  category: string;
  aadhaar: string;
  loan_status?: string;
  loan_amount?: number;
}

export interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  age?: number;
  gender?: string;
  current_password?: string;
  new_password?: string;
}

export interface CustomerDetail extends Customer {
  loans: Loan[];
}

export interface Loan {
  loan_id: number;
  cust_id: string;
  requested_amount: number;
  approved_amount: number;
  status: string;
  reason: string | null;
  interest_rate: number;
  tenure_months: number;
  sanction_letter_path: string | null;
  salary_slip_path: string | null;
  kyc_doc_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all customers (admin endpoint — requires admin token via admin.ts)
 */
export async function getAllCustomers(): Promise<Customer[]> {
  return get<Customer[]>(API_ENDPOINTS.ADMIN_CUSTOMERS);
}

/**
 * Get customer details with loans (customer portal — no admin token)
 */
export async function getCustomerDetail(
  customerId: string
): Promise<CustomerDetail> {
  return get<CustomerDetail>(API_ENDPOINTS.CUSTOMER_DETAIL(customerId));
}

/**
 * Update customer profile (dashboard settings)
 */
export async function updateCustomerProfile(
  customerId: string,
  payload: ProfileUpdatePayload
): Promise<{ success: boolean; customer: Customer }> {
  return put(API_ENDPOINTS.CUSTOMER_PROFILE(customerId), payload);
}

async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    let detail = 'Download failed';
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      detail = await response.text().catch(() => detail);
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadSanctionLetter(
  customerId: string,
  loanId: number
): Promise<void> {
  await downloadFromUrl(
    API_ENDPOINTS.SANCTION_LETTER(customerId, loanId),
    `sanction_letter_${customerId}_${loanId}.pdf`
  );
}

export async function downloadLoanStatement(
  customerId: string,
  loanId: number
): Promise<void> {
  await downloadFromUrl(
    API_ENDPOINTS.LOAN_STATEMENT(customerId, loanId),
    `loan_statement_${customerId}_${loanId}.txt`
  );
}

