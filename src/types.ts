export interface User {
  id: string;
  name: string;
  email: string;
  room_no: string;
  role: 'student' | 'admin';
}

export interface Complaint {
  complaint_id: string;
  user_id: string;
  student_name: string;
  room_no: string;
  complaint_text: string;
  category: 'Electricity' | 'Water' | 'WiFi' | 'Cleanliness' | 'Mess' | 'Furniture' | 'Security' | 'Others';
  priority: 'Red' | 'Orange' | 'Green';
  priority_score: number;
  status: 'Pending' | 'In Progress' | 'Resolved';
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  red: number;
  orange: number;
  green: number;
}
