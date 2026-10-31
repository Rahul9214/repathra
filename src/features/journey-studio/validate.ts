import { journeyDocumentSchema } from "@/features/journey-studio/schema";
import type { JourneyDocument, JourneyIssue, JourneyStep } from "@/features/journey-studio/model";

export type JourneyValidation =
  | { ok: true; document: JourneyDocument }
  | { ok: false; issues: JourneyIssue[] };

export function validateJourney(input: unknown): JourneyValidation {
  const preview = previewTransitionIssues(input);
  const parsed = journeyDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const shape = parsed.error.issues.map((issue) => ({
      code: "invalid_shape" as const,
      path: issue.path.map(String).join("."),
      message: issue.message,
    }));
    return { ok: false, issues: dedupe([...preview, ...shape]) };
  }

  const graph = graphIssues(parsed.data);
  const issues = dedupe([...preview, ...graph]);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, document: parsed.data };
}

function previewTransitionIssues(input: unknown): JourneyIssue[] {
  if (!input || typeof input !== "object" || !("steps" in input) || !Array.isArray(input.steps)) {
    return [];
  }

  const issues: JourneyIssue[] = [];
  input.steps.forEach((step, index) => {
    if (!step || typeof step !== "object") return;
    const record = step as Record<string, unknown>;
    const path = `steps.${index}.next`;
    if (record.type === "complete" && record.next !== null) {
      issues.push({
        code: "invalid_transition",
        path,
        message: "A complete step cannot transition to another step.",
      });
    }
    if (record.type !== "complete" && record.type !== "decide" && record.next === null) {
      issues.push({
        code: "invalid_transition",
        path,
        message: "This step must name the step it transitions to.",
      });
    }
    if (record.type === "decide" && Array.isArray(record.outcomes)) {
      record.outcomes.forEach((outcome, outcomeIndex) => {
        if (!outcome || typeof outcome !== "object") return;
        const next = (outcome as { next?: unknown }).next;
        if (typeof next !== "string" || next.trim() === "") {
          issues.push({
            code: "invalid_transition",
            path: `steps.${index}.outcomes.${outcomeIndex}.next`,
            message: "Each decision outcome must transition to a step.",
          });
        }
      });
    }
  });
  return issues;
}

function graphIssues(document: JourneyDocument): JourneyIssue[] {
  const issues: JourneyIssue[] = [];
  const ids = new Set<string>();
  const duplicates = new Set<string>();

  for (const step of document.steps) {
    if (ids.has(step.id)) duplicates.add(step.id);
    ids.add(step.id);
  }

  for (const id of duplicates) {
    issues.push({
      code: "invalid_shape",
      path: "steps",
      message: `Step id ${id} is used more than once.`,
    });
  }

  if (document.steps[0]?.id !== document.entryStepId) {
    issues.push({
      code: "invalid_shape",
      path: "entryStepId",
      message: "The entry step must be the first step.",
    });
  }

  if (!ids.has(document.entryStepId)) {
    issues.push({
      code: "invalid_transition",
      path: "entryStepId",
      message: "The entry step does not exist.",
    });
  }

  const fieldKeys = new Set<string>();
  for (const [index, step] of document.steps.entries()) {
    if (step.type !== "collect") continue;
    if (fieldKeys.has(step.fieldKey)) {
      issues.push({
        code: "invalid_shape",
        path: `steps.${index}.fieldKey`,
        message: `Field key ${step.fieldKey} is used more than once.`,
      });
    }
    fieldKeys.add(step.fieldKey);
  }

  const adjacency = new Map<string, string[]>();
  let completeCount = 0;

  for (const [index, step] of document.steps.entries()) {
    const edges = edgesOf(step, index, issues);
    adjacency.set(step.id, edges);
    if (step.type === "complete") completeCount += 1;
    for (const target of edges) {
      if (target === step.id) {
        issues.push({
          code: "invalid_transition",
          path: `steps.${index}.next`,
          message: `Step ${step.id} cannot transition to itself.`,
        });
      } else if (!ids.has(target)) {
        issues.push({
          code: "invalid_transition",
          path: edgePath(step, index, target),
          message: `Step ${step.id} transitions to ${target}, which is not in this journey.`,
        });
      }
    }
  }

  if (completeCount === 0) {
    issues.push({
      code: "invalid_transition",
      path: "steps",
      message: "The journey has no complete step.",
    });
  }

  if (hasCycle(document.entryStepId, adjacency)) {
    issues.push({
      code: "invalid_transition",
      path: "steps",
      message: "The journey contains a cycle. Transitions must move toward a complete step.",
    });
  }

  const reachable = reachableFrom(document.entryStepId, adjacency);
  for (const [index, step] of document.steps.entries()) {
    if (!reachable.has(step.id)) {
      issues.push({
        code: "invalid_transition",
        path: `steps.${index}.id`,
        message: `Step ${step.id} is not reachable from the entry step.`,
      });
      continue;
    }
    if (!reachesComplete(step.id, document.steps, adjacency)) {
      issues.push({
        code: "invalid_transition",
        path: `steps.${index}.id`,
        message: `Step ${step.id} has no path to a complete step.`,
      });
    }
  }

  return issues;
}

function edgesOf(step: JourneyStep, index: number, issues: JourneyIssue[]): string[] {
  if (step.type === "complete") return [];
  if (step.type === "decide") {
    const seen = new Set<string>();
    const edges: string[] = [];
    step.outcomes.forEach((outcome, outcomeIndex) => {
      if (seen.has(outcome.id)) {
        issues.push({
          code: "invalid_shape",
          path: `steps.${index}.outcomes.${outcomeIndex}.id`,
          message: `Outcome id ${outcome.id} is used more than once on step ${step.id}.`,
        });
      }
      seen.add(outcome.id);
      edges.push(outcome.next);
    });
    return edges;
  }
  return [step.next];
}

function edgePath(step: JourneyStep, index: number, target: string): string {
  if (step.type === "decide") {
    const outcomeIndex = step.outcomes.findIndex((outcome) => outcome.next === target);
    return `steps.${index}.outcomes.${Math.max(outcomeIndex, 0)}.next`;
  }
  return `steps.${index}.next`;
}

function hasCycle(entry: string, adjacency: Map<string, string[]>): boolean {
  const color = new Map<string, "gray" | "black">();
  const visit = (id: string): boolean => {
    const state = color.get(id);
    if (state === "gray") return true;
    if (state === "black") return false;
    color.set(id, "gray");
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    color.set(id, "black");
    return false;
  };
  return visit(entry);
}

function reachableFrom(entry: string, adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const next of adjacency.get(id) ?? []) stack.push(next);
  }
  return seen;
}

function reachesComplete(
  start: string,
  steps: readonly JourneyStep[],
  adjacency: Map<string, string[]>,
): boolean {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (byId.get(id)?.type === "complete") return true;
    for (const next of adjacency.get(id) ?? []) stack.push(next);
  }
  return false;
}

function dedupe(issues: JourneyIssue[]): JourneyIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.path}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
