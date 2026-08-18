/**
 * useT — shorthand hook that returns the current theme tokens + theme class.
 * Import this in any component to get theme-aware colors without prop-drilling.
 */
import { useTheme } from "../context/ThemeContext";

export function useT() {
  const { tokens, isDark } = useTheme();
  return { ...tokens, isDark };
}
