export interface SaweriaDonationPayload {
  type: string;
  donator_name?: string;
  donator_email?: string;
  amount_raw?: number;
  message?: string;
  [key: string]: unknown;
}

