/**
 * Security Reviewer
 *
 * Reviews code and artifacts for security vulnerabilities
 * based on OWASP Top 10 and security best practices.
 */

import { ReviewerAgent, type ReviewerConfig } from '../reviewer';

/**
 * OWASP Top 10 (2021) based security criteria
 */
const OWASP_SECURITY_CRITERIA = [
  // A01:2021 - Broken Access Control
  'Access control checks are in place for all protected resources',
  'Authorization is enforced server-side, not just client-side',
  'Default deny principle - access denied unless explicitly granted',

  // A02:2021 - Cryptographic Failures
  'Sensitive data is encrypted at rest and in transit',
  'No hardcoded secrets, API keys, or credentials',
  'Strong encryption algorithms are used (no MD5, SHA1 for security)',

  // A03:2021 - Injection
  'All user input is validated and sanitized',
  'Parameterized queries used for database operations',
  'No direct concatenation of user input in queries or commands',

  // A04:2021 - Insecure Design
  'Security requirements are defined in the design',
  'Threat modeling has been considered',
  'Defense in depth - multiple layers of security',

  // A05:2021 - Security Misconfiguration
  'Secure defaults are used',
  'Error messages do not leak sensitive information',
  'Security headers are configured (CSP, HSTS, etc.)',

  // A06:2021 - Vulnerable Components
  'Dependencies are from trusted sources',
  'No known vulnerable dependencies',

  // A07:2021 - Authentication Failures
  'Strong password policies enforced',
  'Rate limiting on authentication endpoints',
  'Session management is secure',

  // A08:2021 - Software and Data Integrity Failures
  'Code integrity is verified',
  'CI/CD pipeline is secure',

  // A09:2021 - Security Logging and Monitoring
  'Security events are logged',
  'Logs do not contain sensitive data',

  // A10:2021 - Server-Side Request Forgery (SSRF)
  'URL inputs are validated',
  'No server-side requests to user-controlled URLs without validation',
];

/**
 * Security reviewer system prompt
 */
const SECURITY_REVIEWER_PROMPT = `You are a security auditor reviewing code for vulnerabilities.

You apply OWASP Top 10 (2021) guidelines and security best practices:

1. **Broken Access Control** - Check authorization on all endpoints
2. **Cryptographic Failures** - Look for exposed secrets, weak crypto
3. **Injection** - SQL, NoSQL, Command, LDAP injection vectors
4. **Insecure Design** - Security baked into architecture
5. **Security Misconfiguration** - Default credentials, verbose errors
6. **Vulnerable Components** - Known vulnerable dependencies
7. **Authentication Failures** - Weak auth, session management issues
8. **Integrity Failures** - Code and data integrity
9. **Logging Failures** - Missing or excessive logging
10. **SSRF** - Server-side request forgery vulnerabilities

Be thorough - security issues can have severe consequences.
Flag any potential vulnerability even if exploitation is unclear.

Categorize findings by severity:
- CRITICAL: Immediate exploitation risk
- HIGH: Significant vulnerability
- MEDIUM: Potential vulnerability with mitigations
- LOW: Best practice deviation`;

/**
 * Security reviewer configuration
 */
const securityReviewerConfig: ReviewerConfig = {
  name: 'Security Reviewer',
  agent: 'vaf-security-review',
  domain: 'security',
  systemPrompt: SECURITY_REVIEWER_PROMPT,
  reviewCriteria: OWASP_SECURITY_CRITERIA,
};

/**
 * Security Reviewer Agent
 */
export class SecurityReviewer extends ReviewerAgent {
  constructor() {
    super(securityReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const securityReviewer = new SecurityReviewer();

/**
 * Code-specific security criteria
 */
const CODE_SECURITY_CRITERIA = [
  'No secrets or API keys in code',
  'No PII or sensitive data logged',
  'Input validation on all external data',
  'Output encoding to prevent XSS',
  'CSRF protection on state-changing operations',
  'Secure cookie flags (HttpOnly, Secure, SameSite)',
  'No eval() or Function() with user input',
  'No dangerouslySetInnerHTML without sanitization',
  'SQL/NoSQL queries are parameterized',
  'File uploads are validated and sandboxed',
  'Authentication tokens are securely stored',
  'Password handling follows best practices',
  'Rate limiting on sensitive endpoints',
  'Error handling does not leak stack traces',
];

/**
 * Code security reviewer configuration
 */
const codeSecurityReviewerConfig: ReviewerConfig = {
  name: 'Code Security Reviewer',
  agent: 'vaf-security-review',
  domain: 'code-security',
  systemPrompt: `You are reviewing code specifically for security vulnerabilities.

Focus on:
- Injection vulnerabilities (SQL, XSS, Command)
- Authentication and session security
- Secret management
- Input validation and output encoding
- Secure error handling

This is code that will run in production facing real users.
Be thorough and err on the side of caution.`,
  reviewCriteria: CODE_SECURITY_CRITERIA,
};

/**
 * Code Security Reviewer Agent
 */
export class CodeSecurityReviewer extends ReviewerAgent {
  constructor() {
    super(codeSecurityReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const codeSecurityReviewer = new CodeSecurityReviewer();

/**
 * Architecture security criteria
 */
const ARCHITECTURE_SECURITY_CRITERIA = [
  'Security requirements are explicitly defined',
  'Authentication architecture is robust',
  'Authorization model is well-designed',
  'Data classification and protection levels defined',
  'Network security boundaries are clear',
  'Encryption strategy is comprehensive',
  'Key management approach is defined',
  'Logging and monitoring strategy exists',
  'Incident response considerations',
  'Compliance requirements addressed',
  'Third-party integrations assessed for security',
  'Data flow includes security controls',
];

/**
 * Architecture security reviewer configuration
 */
const architectureSecurityReviewerConfig: ReviewerConfig = {
  name: 'Architecture Security Reviewer',
  agent: 'vaf-security-review',
  domain: 'architecture-security',
  systemPrompt: `You are reviewing architecture from a security perspective.

Focus on:
- Security requirements completeness
- Authentication and authorization design
- Data protection strategy
- Network security
- Third-party integration risks
- Compliance considerations

Architecture security issues are expensive to fix later.
Identify gaps early.`,
  reviewCriteria: ARCHITECTURE_SECURITY_CRITERIA,
};

/**
 * Architecture Security Reviewer Agent
 */
export class ArchitectureSecurityReviewer extends ReviewerAgent {
  constructor() {
    super(architectureSecurityReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const architectureSecurityReviewer = new ArchitectureSecurityReviewer();

/**
 * Secrets detection patterns
 */
const SECRET_PATTERNS = [
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
  /secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
  /password\s*[:=]\s*['"][^'"]+['"]/gi,
  /token\s*[:=]\s*['"][^'"]+['"]/gi,
  /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  /aws[_-]?access[_-]?key[_-]?id\s*[:=]\s*['"]?[A-Z0-9]{20}['"]?/gi,
  /aws[_-]?secret[_-]?access[_-]?key\s*[:=]/gi,
];

/**
 * Quick secret scan - checks for common secret patterns
 */
export function quickSecretScan(content: string): {
  hasSecrets: boolean;
  findings: string[];
} {
  const findings: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.push(`Potential secret found: ${pattern.source.slice(0, 30)}...`);
    }
  }

  return {
    hasSecrets: findings.length > 0,
    findings,
  };
}

/**
 * XSS vulnerability patterns
 */
const XSS_PATTERNS = [
  /dangerouslySetInnerHTML/g,
  /innerHTML\s*=/g,
  /document\.write\(/g,
  /eval\(/g,
  /new\s+Function\(/g,
];

/**
 * Quick XSS scan - checks for common XSS patterns
 */
export function quickXssScan(content: string): {
  hasVulnerabilities: boolean;
  findings: string[];
} {
  const findings: string[] = [];

  for (const pattern of XSS_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.push(`Potential XSS vector: ${pattern.source}`);
    }
  }

  return {
    hasVulnerabilities: findings.length > 0,
    findings,
  };
}

/**
 * Quick security scan - combines secret and XSS scans
 */
export function quickSecurityScan(content: string): {
  passed: boolean;
  secretFindings: string[];
  xssFindings: string[];
} {
  const secretScan = quickSecretScan(content);
  const xssScan = quickXssScan(content);

  return {
    passed: !secretScan.hasSecrets && !xssScan.hasVulnerabilities,
    secretFindings: secretScan.findings,
    xssFindings: xssScan.findings,
  };
}
