export type Category = 'discovery' | 'readability' | 'interactions' | 'integrations';
export type Profile = 'html' | 'browser' | 'api';
export type Severity = 'high' | 'medium' | 'low' | 'info';
export type CheckStatus = 'pass' | 'warning' | 'fail' | 'not_tested';

export const CATEGORY_META: Record<Category, { title: string; question: string; description: string }> = {
  discovery: { title: 'Find & access', question: 'Can an agent reach the right place?', description: 'Navigation, reachable pages and access barriers.' },
  readability: { title: 'Read & understand', question: 'Can an agent understand your product?', description: 'Meaningful content, structured data and rendering.' },
  interactions: { title: 'Use & complete', question: 'Can an agent operate the interface?', description: 'Named controls, form labels and clear outcomes.' },
  integrations: { title: 'Connect directly', question: 'Is there a documented tool interface?', description: 'Published APIs, documentation and integration paths.' },
};

export interface Control {
  id: string;
  tag: string;
  role: string;
  name: string;
  text: string;
  type: string;
  href?: string;
  value?: string;
  disabled: boolean;
  required: boolean;
  selector: string;
  snippet: string;
  options?: { label: string; value: string }[];
}

export interface PageEvidence {
  id: string;
  url: string;
  title: string;
  status: number;
  rawTextLength: number;
  rawHtmlCaptured?: boolean;
  renderedTextLength: number;
  text: string;
  headings: string[];
  controls: Control[];
  links: { text: string; href: string }[];
  structuredData: { valid: number; invalid: number; types: string[] };
  consoleErrors: string[];
  requestErrors: string[];
  screenshot?: string;
  inspectedAt: string;
  error?: string;
}

export interface Evidence {
  id: string;
  pageId: string;
  url: string;
  description: string;
  snippet?: string;
  selector?: string;
  screenshot?: string;
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  observation: string;
  impact: string;
  profiles: Profile[];
  kind: 'observed' | 'recommendation';
  evidenceIds: string[];
  fix: string;
  code?: string;
  verification: string;
  source: 'rule' | 'nemotron';
}

export interface CheckResult {
  id: string;
  category: Category;
  name: string;
  status: CheckStatus;
  detail: string;
  evidenceIds: string[];
}

export interface AuditEvent { time: string; message: string; }
// Metadata from real SDK calls only. Never store API keys or model prompts here.
export interface InferenceRecord {
  id: string;
  provider: 'nebius' | 'custom';
  endpointOrigin: string;
  requestedModel: string;
  responseModel?: string;
  responseId?: string;
  requestId?: string;
  tool: string;
  startedAt: string;
  durationMs: number;
  status: 'succeeded' | 'failed';
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  error?: string;
}
export interface Audit {
  id: string;
  url: string;
  domain: string;
  status: 'queued' | 'crawling' | 'analyzing' | 'complete' | 'failed';
  createdAt: string;
  completedAt?: string;
  progress: number;
  events: AuditEvent[];
  pages: PageEvidence[];
  evidence: Evidence[];
  findings: Finding[];
  checks: CheckResult[];
  summary: string;
  suggestedTask?: string;
  model: { mode: 'pending' | 'rules' | 'nemotron'; name: string; note: string };
  inference?: InferenceRecord[];
  limitations: string[];
  error?: string;
  isDemo: boolean;
  compareWith?: string;
}

export type Outcome = 'completed' | 'failed' | 'blocked' | 'inconclusive';
export type Assertion =
  | { kind: 'url_contains'; value: string }
  | { kind: 'visible_text'; value: string }
  | { kind: 'fixture_cart'; sku: string; color: string; size: string; quantity: number };
export interface AssertionResult { description: string; passed: boolean; actual: string; }
export interface RunStep {
  index: number;
  time: string;
  url: string;
  action: string;
  target?: string;
  result: string;
  screenshot?: string;
  error?: string;
  durationMs: number;
}
export interface TaskRun {
  id: string;
  auditId: string;
  startUrl: string;
  goal: string;
  assertions: Assertion[];
  status: 'queued' | 'running' | 'complete';
  outcome?: Outcome;
  cause?: 'site' | 'agent' | 'observation' | 'infrastructure' | 'unknown';
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  steps: RunStep[];
  checks: AssertionResult[];
  explanation: string;
  model: string;
  inference?: InferenceRecord[];
  profile: 'rendered-dom';
  promptVersion: string;
  maxSteps: number;
  maxDurationMs: number;
  trace?: string;
  compareWith?: string;
}

export interface Health {
  version: string;
  model: string;
  ai: 'unconfigured' | 'configured' | 'verified' | 'error';
  aiMessage: string;
  aiEnabled: boolean;
  trialMode: 'live' | 'scripted-demo' | 'unavailable';
  browserInstalled: boolean;
  demoUrl: string;
  fixedDemoUrl: string;
  demoAvailable: boolean;
  activeJobs: number;
  queuedJobs: number;
  needsAuth: boolean;
}

export interface AuditSummary {
  id: string; url: string; domain: string; status: Audit['status'];
  createdAt: string; completedAt?: string; pageCount: number; findingCount: number;
  highCount: number; isDemo: boolean; modelMode: Audit['model']['mode'];
}

export interface AuditComparison {
  beforeId: string;
  afterId: string;
  scopeMatched: boolean;
  beforePages: string[];
  afterPages: string[];
  counts: { before: Record<CheckStatus, number>; after: Record<CheckStatus, number> };
  changes: {
    id: string; name: string; category: Category;
    before?: CheckStatus; after?: CheckStatus;
    transition: 'improved' | 'regressed' | 'unchanged' | 'unverified';
    beforeEvidenceIds: string[]; afterEvidenceIds: string[];
  }[];
  limitations: string[];
}

export interface RunComparison {
  beforeId: string;
  afterId: string;
  comparable: boolean;
  reasons: string[];
  transition: 'improved' | 'regressed' | 'unchanged' | 'changed' | 'unverified';
  before: { outcome?: Outcome; checks: AssertionResult[]; steps: number; durationMs?: number; model: string };
  after: { outcome?: Outcome; checks: AssertionResult[]; steps: number; durationMs?: number; model: string };
  limitations: string[];
}
