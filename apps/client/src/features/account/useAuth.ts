import { useAuthContext } from "./AuthContext";

export { AuthProvider, useAuthContext } from "./AuthContext";

export function useAuth() {
  return useAuthContext();
}
