export interface AdminCustomer {
  cust_id: string;
  name: string;
  age: number;
  gender?: string;
  phone: string;
  address: string;
  credit_score: number;
  pre_approved_limit: number;
  interest_options: string[];
  aadhaar: string;
  category: string;
  loan_status?: string | null;
  loan_amount?: number | null;
  loans?: AdminLoan[];
}

export interface AdminLoan {
  loan_id: number;
  cust_id?: string;
  requested_amount?: number;
  approved_amount?: number;
  status?: string;
  reason?: string;
  bank_id?: string | null;
  reviewed_by_banker_id?: string | null;
  review_note?: string | null;
  created_at?: string;
}

export interface AuditLogEntry {
  audit_id: number;
  loan_id: number;
  cust_id?: string;
  customer_name?: string;
  action: string;
  banker_id: string;
  banker_name?: string;
  bank_id?: string;
  bank_name?: string;
  requested_amount?: number;
  approved_amount?: number;
  note?: string;
  created_at?: string;
}

export interface MonitorBanker {
  banker_id: string;
  name: string;
  role: string;
  is_active: boolean;
  approval_status?: string;
  email?: string | null;
  bank_id: string;
  bank_name: string;
  bank_code?: string;
  total_decisions?: number;
  decisions_last_7_days?: number;
  created_at?: string;
  approved_at?: string | null;
}

export interface MonitorOverview {
  banks: Array<{
    bank_id: string;
    bank_name: string;
    bank_code: string;
    officer_count: number;
    active_officers: number;
  }>;
  activityByBank: Array<{
    bank_name: string;
    approvals: number;
    rejections: number;
  }>;
  recentAudit: AuditLogEntry[];
  totalAuditEvents: number;
}

export interface AdminChatMessage {
  id?: string;
  cust_id?: string;
  sender: string;
  message: string;
  timestamp: string;
}
