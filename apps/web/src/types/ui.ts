export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'warning' | 'success' | 'danger';
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  durationMs?: number;
}
