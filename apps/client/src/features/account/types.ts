export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface UserPreferences {
  defaultOcrLanguage: string;
  defaultCompressionLevel: number;
  theme: "system" | "light" | "dark";
  autoDownload: boolean;
}

export interface UserProductivityMetrics {
  totalOperations: number;
  totalBytesSaved: number;
  toolsUsage: { toolId: string; toolTitle: string; count: number }[];
}

export interface AuthSession {
  user: UserProfile | null;
  preferences: UserPreferences;
  isGuest: boolean;
  token?: string;
}

export interface DeleteAccountOptions {
  wipeLocalData?: boolean;
}
