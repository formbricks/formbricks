export interface FixtureDiagnostic {
  ruleId: string | null;
  severity: "error" | "warning" | "advice";
  message: string;
  line: number | undefined;
}

export declare const ruleIdOf: (code: string | undefined) => string | null;
export declare function lintFixtures(
  workspaceDir: string,
  files: Record<string, string>,
  options?: { env?: Record<string, string>; typeAware?: boolean }
): Record<string, FixtureDiagnostic[]>;
export declare function fixFixtures(
  workspaceDir: string,
  files: Record<string, string>,
  options?: { env?: Record<string, string>; typeAware?: boolean }
): Record<string, string>;
