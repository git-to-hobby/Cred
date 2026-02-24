import { get, post, patch, ApiClientError } from './client';
import { API_ENDPOINTS } from './config';
import { adminAuthHeaders, handleAdminUnauthorized } from './adminAuth';
import type { AdminCustomer, AdminChatMessage, AdminLoan, AuditLogEntry, MonitorBanker, MonitorOverview } from '@/types/admin';

async function adminGet<T>(url: string): Promise<T> {
  try {
    return await get<T>(url, { headers: adminAuthHeaders() });
  } catch (err) {
    if (err instanceof ApiClientError) handleAdminUnauthorized(err.status);
    throw err;
  }
}

async function adminPost<T>(url: string, body?: unknown): Promise<T> {
  try {
    return await post<T>(url, body, { headers: adminAuthHeaders() });
  } catch (err) {
    if (err instanceof ApiClientError) handleAdminUnauthorized(err.status);
    throw err;
  }
}

async function adminPatch<T>(url: string, body?: unknown): Promise<T> {
  try {
    return await patch<T>(url, body, { headers: adminAuthHeaders() });
  } catch (err) {
    if (err instanceof ApiClientError) handleAdminUnauthorized(err.status);
    throw err;
  }
}

export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  return adminGet<AdminCustomer[]>(API_ENDPOINTS.ADMIN_CUSTOMERS);
}

export async function getAdminCustomer(custId: string): Promise<AdminCustomer> {
  return adminGet<AdminCustomer>(API_ENDPOINTS.ADMIN_CUSTOMER(custId));
}

export async function getAdminChatHistory(custId: string): Promise<AdminChatMessage[]> {
  return adminGet<AdminChatMessage[]>(API_ENDPOINTS.ADMIN_CHAT(custId));
}

export async function decideLoan(
  loanId: number,
  action: 'approve' | 'reject',
  note?: string
): Promise<{ status: string; loan: AdminLoan; bankName: string; bankerName: string }> {
  return adminPost(
    API_ENDPOINTS.ADMIN_LOAN_DECISION(loanId),
    { action, note: note ?? '' }
  );
}

export async function getMonitorOverview(): Promise<MonitorOverview> {
  return adminGet<MonitorOverview>(API_ENDPOINTS.ADMIN_MONITOR_OVERVIEW);
}

export async function getMonitorAudit(limit = 50): Promise<AuditLogEntry[]> {
  return adminGet<AuditLogEntry[]>(`${API_ENDPOINTS.ADMIN_MONITOR_AUDIT}?limit=${limit}`);
}

export async function getMonitorBankers(): Promise<MonitorBanker[]> {
  return adminGet<MonitorBanker[]>(API_ENDPOINTS.ADMIN_MONITOR_BANKERS);
}

export async function setBankerActive(bankerId: string, isActive: boolean) {
  return adminPatch(API_ENDPOINTS.ADMIN_MONITOR_BANKER(bankerId), { is_active: isActive });
}

export async function createBankerRequest(data: {
  name: string;
  bankId: string;
  role?: string;
  email?: string;
}) {
  return adminPost(API_ENDPOINTS.ADMIN_MONITOR_BANKERS, data);
}

export async function approveBanker(bankerId: string) {
  return adminPost(API_ENDPOINTS.ADMIN_MONITOR_BANKER_APPROVE(bankerId), {});
}

export async function rejectBanker(bankerId: string) {
  return adminPost(API_ENDPOINTS.ADMIN_MONITOR_BANKER_REJECT(bankerId), {});
}
