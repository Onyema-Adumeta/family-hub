// ─── Shared Types for Family Hub ───────────────────────────────

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export interface Member {
  id: string;
  familyId: string;
  name: string;
  emoji: string;
  color: string;
  role: 'parent' | 'child';
  stars: number;
  streakDays?: number;
  streakUpdatedAt?: string | null;
  pushToken?: string;
}

export interface Chore {
  id: string;
  familyId: string;
  title: string;
  emoji: string;
  assignedTo?: string;
  frequency: 'daily' | 'weekly' | 'once';
  stars: number;
  done: boolean;
  proofRequired: boolean;
  proofUrl?: string;
  proofType?: 'image' | 'video';
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
}

export interface Meal {
  id: string;
  familyId: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  emoji: string;
  notes?: string;
  assignedTo?: string;
  week: string; // ISO date of Monday
}

export interface Event {
  id: string;
  familyId: string;
  title: string;
  emoji: string;
  date: string;
  time?: string;
  assignedTo?: string;
  color?: string;
  notes?: string;
  createdAt: string;
}

export interface Reward {
  id: string;
  familyId: string;
  name: string;
  emoji: string;
  cost: number;
  description?: string;
  availableCount?: number;
}

export interface Redemption {
  id: string;
  familyId: string;
  memberId: string;
  rewardId: string;
  reward: Reward;
  member: Member;
  approved: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  familyId: string;
  memberId: string;
  member?: Member;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  replyToId?: string;
  pinned: boolean;
  createdAt: string;
}

export interface Quest {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  emoji: string;
  type: 'family' | 'individual';
  goal: number;
  progress: number;
  reward: number;
  deadline?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  familyId: string;
  memberId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface WeeklyReport {
  week: string;
  choresCompleted: number;
  totalStars: number;
  topMember?: Member;
  streak: number;
  highlights: string[];
  aiSummary?: string;
}

export interface AuthResponse {
  token: string;
  member: Member;
  family: Family;
}
