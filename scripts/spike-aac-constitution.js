#!/usr/bin/env node

// Fork spike (SkylerChenTaiwan/loom#1): verify the architecture artifact (AAC) can be read
// from a project-level constitution at .loom/contracts/constitution/, with the original
// per-delivery locator path acting only as a fallback, AND that review reconciliation does
// not depend on the AAC living under deliveries/{id}/.../{phaseId}/.
//
// Three independent project roots:
//   A. constitution-only  -> review must succeed AND load the constitution AAC (distinct id).
//   B. no-aac-anywhere    -> review must fail with "ArchitectureArtifactContract ... does not exist".
//   C. per-delivery-only  -> review must succeed (original fallback path intact).
//
// A vs B isolates the constitution file as the single cause of review succeeding.
// The distinct constitution id (aac-constitution-spike) vs the taskPlan-referenced id
// (aac-review-scope) proves provenance and probes for a hidden "loaded id must equal
// taskPlan ref" coupling.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const cli = path.join(repoRoot, "dist", "cli.js");

const CONSTITUTION_AAC_ID = "aac-constitution-spike";
const PER_DELIVERY_AAC_ID = "aac-review-scope";

function run(args, projectRoot, { expectOk = true } = {}) {
  let output;
  try {
    output = execFileSync(process.execPath, [cli, ...args, "--project-root", projectRoot, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, LOOM_AGENT_PROFILE: "codex" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // Non-zero exit still prints the JSON envelope on stdout for loom errors.
    output = error.stdout ? error.stdout.toString() : "";
    if (!output) throw error;
  }
  const envelope = JSON.parse(output);
  if (expectOk) {
    assert.equal(envelope.ok, true, `${args.join(" ")} expected ok but failed: ${output}`);
  }
  return envelope;
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function projectFile(root, relativePath) {
  return path.join(root, relativePath);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function hydrateRequest(root, request) {
  const hydrated = { ...request };
  for (const [key, value] of Object.entries(request)) {
    if (!key.endsWith("Ref") || typeof value !== "string" || key === "requestRef") continue;
    const targetKey = key.slice(0, -"Ref".length);
    if (targetKey in hydrated) continue;
    hydrated[targetKey] = readJson(projectFile(root, value));
  }
  return hydrated;
}

function now() {
  return "2026-05-24T00:00:00.000Z";
}

function aacContract(architectureArtifactContractId) {
  return {
    schemaVersion: "1.0",
    architectureArtifactContractId,
    status: "ready",
    source: {
      planningGenerationContractId: "pgc-review-scope",
      technicalBaselineId: "tb-review-scope",
      brainstormContractId: "brainstorm-contract-review-scope",
      roadmapId: null,
      phaseId: "phase-1",
    },
    engineeringBoundary: {
      projectKind: "existing_project",
      strategy: "extend_existing_modules",
      applications: [{ appId: "app-main", type: "library", root: "." }],
      modules: [{ moduleId: "module-review", appId: "app-main", paths: ["src"], responsibility: "Review scope fixture." }],
      creationPolicy: { createOnlyCurrentPhasePaths: true, avoidFuturePhaseScaffolding: true },
    },
    modules: [{
      moduleId: "module-review",
      name: "Review Scope",
      responsibility: "Review declared changed files.",
      dependsOn: [],
      scopeRefs: ["scope-review"],
      acceptanceRefs: ["AC-review"],
    }],
    dataModel: { entities: [], relationships: [], constraints: [] },
    interfaces: [],
    userFlows: [],
    stateMachines: [],
    acceptanceMatrix: [{
      acceptanceId: "AC-review",
      priority: "must",
      statement: "Review only declared changed files.",
      coverageStatus: "covered",
      coverage: [{ type: "module", refs: ["module-review"], description: "Fixture module." }],
      verificationHints: [{ kind: "static", description: "Review request scopes changed files." }],
    }],
    risksAndDecisions: { decisions: [], risks: [], assumptions: [], deferredNotes: [] },
    handoff: { readyForTaskPlan: true, blockingReasons: [], nextNode: "task_plan" },
    createdAt: now(),
    updatedAt: now(),
  };
}

// Writes a complete review-ready .loom state. `aacPlacement` controls where (if anywhere) the
// AAC is written: "constitution" | "delivery" | "none".
function writeReviewReadyState(root, aacPlacement) {
  const deliveryId = "delivery-review-scope";
  const phaseId = "phase-1";
  const taskPlanId = "taskplan-review-scope";
  const runId = "run-review-scope";
  const taskId = "task-review-scope";
  const resultId = "result-review-scope";

  writeJson(projectFile(root, ".loom/status.json"), {
    schemaVersion: 1,
    activeDeliveryId: deliveryId,
    lastCompletedDeliveryId: null,
    deliveries: [{
      deliveryId,
      status: "reviewing",
      requestSummary: "Spike: AAC from project-level constitution.",
      activePhaseId: phaseId,
      indexRef: `.loom/deliveries/${deliveryId}/index.json`,
      updatedAt: now(),
    }],
    effectiveNextAction: {
      type: "review",
      source: "task_plan_run",
      deliveryId,
      phaseId,
      reason: "TASKPLAN_RUN_COMPLETED",
      targetNode: "review",
    },
    phase: "reviewing",
    current: { requirementId: null, planId: null, taskId: null, reviewId: null, repairId: null, deploymentId: null },
    lastAction: null,
    nextAction: "review",
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/index.json`), {
    schemaVersion: "1.0",
    deliveryId,
    status: "reviewing",
    requestSummary: "Spike: AAC from project-level constitution.",
    roadmapId: null,
    activePhaseId: phaseId,
    phases: [{
      phaseId,
      name: "Phase 1",
      status: "reviewing",
      latestRefs: {
        taskPlan: `.loom/deliveries/${deliveryId}/tasks/${phaseId}/taskplans/${taskPlanId}.json`,
        taskPlanRun: `.loom/deliveries/${deliveryId}/tasks/${phaseId}/runs/${runId}.json`,
      },
      nextAction: {
        type: "review",
        source: "task_plan_run",
        deliveryId,
        phaseId,
        reason: "TASKPLAN_RUN_COMPLETED",
        targetNode: "review",
      },
    }],
    createdAt: now(),
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/contracts/technical-baseline.json`), {
    schemaVersion: "1.0",
    technicalBaselineId: "tb-review-scope",
    status: "confirmed",
    source: "detected_from_repo",
    projectKind: "existing_project",
    scope: "project",
    stack: { languages: ["TypeScript"], packageManagers: ["npm"], runtime: "node" },
    constraints: [],
    evidence: [{ path: "package.json", reason: "test fixture" }],
    approval: { type: "policy_auto_accept", reason: "test fixture" },
    confidence: "high",
    createdAt: now(),
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/contracts/planning/${phaseId}/pgc.json`), {
    schemaVersion: "1.0",
    planningContractId: "pgc-review-scope",
    status: "ready",
    source: {
      brainstormRunId: "brainstorm-review-scope",
      brainstormContractId: "brainstorm-contract-review-scope",
      roadmapId: null,
      phaseId,
      technicalBaselineId: "tb-review-scope",
    },
    phaseScope: {
      phaseName: "Phase 1",
      phaseGoal: "Verify review scope.",
      included: [{ scopeId: "scope-review", label: "Review declared files", items: ["declared changed file"], source: "test" }],
      deferred: [],
      excluded: [],
      acceptanceCandidates: [{ id: "AC-review", statement: "Review only declared changed files.", priority: "must" }],
    },
    technicalBaseline: {
      technicalBaselineId: "tb-review-scope",
      status: "confirmed",
      scope: "project",
      summary: { languages: ["TypeScript"] },
      mustFollow: true,
    },
    planningInputs: { businessGoal: "Verify review scope.", actors: [], capabilityGroups: [], businessFlows: [], sourceRefs: [], contextNotes: [] },
    planningRules: {
      scopeIsolation: { onlyPlanCurrentPhase: true, forbidDeferredScopeImplementation: true, forbidFuturePhaseImplementation: true },
      outputRequirements: { mustCreateArchitectureArtifactContract: true, mustCreateTaskPlan: true, taskPlanMustReferenceAcceptance: true },
      deployment: { defaultEnabled: false, requiresExplicitUserRequest: true },
    },
    qualityGates: { requiresArchitectureBeforeTaskPlan: true, requiresAcceptanceCoverage: true, requiresVerificationEvidence: true },
    handoff: { readyForArchitecture: true, readyForTaskPlan: true, blockingReasons: [], nextNode: "architecture_artifact_contract" },
    createdAt: now(),
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/contracts/planning/${phaseId}/latest.json`), {
    schemaVersion: "1.0",
    planningContractId: "pgc-review-scope",
    contractRef: `.loom/deliveries/${deliveryId}/contracts/planning/${phaseId}/pgc.json`,
    updatedAt: now(),
  });

  // AAC placement is the variable under test.
  if (aacPlacement === "constitution") {
    // Project-level constitution carries a DISTINCT id to prove provenance.
    writeJson(projectFile(root, ".loom/contracts/constitution/aac.json"), aacContract(CONSTITUTION_AAC_ID));
    writeJson(projectFile(root, ".loom/contracts/constitution/latest.json"), {
      schemaVersion: "1.0",
      architectureArtifactContractId: CONSTITUTION_AAC_ID,
      contractRef: ".loom/contracts/constitution/aac.json",
      updatedAt: now(),
    });
  } else if (aacPlacement === "delivery") {
    writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/artifacts/architecture/${phaseId}/aac.json`), aacContract(PER_DELIVERY_AAC_ID));
    writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/artifacts/architecture/${phaseId}/latest.json`), {
      schemaVersion: "1.0",
      architectureArtifactContractId: PER_DELIVERY_AAC_ID,
      contractRef: `.loom/deliveries/${deliveryId}/artifacts/architecture/${phaseId}/aac.json`,
      planningContractId: "pgc-review-scope",
      updatedAt: now(),
    });
  }
  // "none": deliberately write no AAC anywhere (negative control).

  // taskPlan references the per-delivery id; in the constitution case that file does NOT exist
  // on disk, so a successful review proves the loader did not require it.
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/tasks/${phaseId}/taskplans/${taskPlanId}.json`), {
    schemaVersion: "1.0",
    taskPlanId,
    version: 1,
    status: "ready",
    source: {
      roadmapId: null,
      phaseId,
      planningGenerationContractId: "pgc-review-scope",
      architectureArtifactContractId: PER_DELIVERY_AAC_ID,
      technicalBaselineId: "tb-review-scope",
    },
    scopeSnapshot: { includedScopeRefs: ["scope-review"], excludedScopeRefs: [], deferredScopeRefs: [], acceptanceRefs: ["AC-review"] },
    planningPolicy: {
      taskGranularity: "engineering_increment",
      groupGranularity: "engineering_capability",
      allowTaskSplitDuringRepair: true,
      allowTaskMergeDuringRepair: true,
    },
    groups: [{
      groupId: "group-review",
      title: "Review declared files",
      objective: "Produce one declared changed file.",
      dependsOn: [],
      scopeRefs: ["scope-review"],
      acceptanceRefs: ["AC-review"],
      taskIds: [taskId],
    }],
    tasks: [{
      taskId,
      groupId: "group-review",
      title: "Modify declared file",
      taskKind: "feature_increment",
      implementationActions: ["create_or_update_interface"],
      objective: "Modify only the declared file for review scope.",
      dependsOn: [],
      scopeRefs: ["scope-review"],
      acceptanceRefs: ["AC-review"],
      writeBoundary: {
        forbiddenPaths: [".loom"],
        artifactRefs: { modules: ["module-review"], entities: [], interfaces: [], userFlows: [], stateMachines: [], decisions: [], risks: [] },
      },
      verificationIntents: [{
        verificationId: "VI-review",
        acceptanceRefs: ["AC-review"],
        behavior: "Declared file is reviewed.",
        preferredEvidence: ["static_check"],
        acceptableEvidence: ["static_check", "agent_review_explanation"],
      }],
    }],
    handoff: { readyForExecution: true, nextNode: "task_execution", blockedReasons: [] },
    createdAt: now(),
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/tasks/${phaseId}/taskplans/latest.json`), {
    schemaVersion: "1.0",
    taskPlanId,
    taskPlanRef: `.loom/deliveries/${deliveryId}/tasks/${phaseId}/taskplans/${taskPlanId}.json`,
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/tasks/${phaseId}/runs/${runId}.json`), {
    schemaVersion: "1.0",
    runId,
    taskPlanId,
    status: "completed",
    scheduler: { mode: "group_dag", startedAt: now(), finishedAt: now() },
    groupStates: [{ groupId: "group-review", status: "completed", startedAt: now(), finishedAt: now(), dependsOn: [], taskIds: [taskId] }],
    taskStates: [{
      taskId,
      groupId: "group-review",
      status: "completed",
      resultId,
      startedAt: now(),
      finishedAt: now(),
      dependsOn: [],
      attempts: [{ attempt: 1, resultId, status: "completed" }],
    }],
    summary: { total: 1, completed: 1, completedWithNotes: 0, blocked: 0, failed: 0, pending: 0, running: 0 },
    nextAction: { type: "review", reason: "TASKPLAN_RUN_COMPLETED", targetNode: "review" },
    createdAt: now(),
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/tasks/${phaseId}/runs/latest.json`), {
    schemaVersion: "1.0",
    taskPlanRunId: runId,
    runRef: `.loom/deliveries/${deliveryId}/tasks/${phaseId}/runs/${runId}.json`,
    taskPlanId,
    updatedAt: now(),
  });
  writeJson(projectFile(root, `.loom/deliveries/${deliveryId}/tasks/${phaseId}/results/${runId}/${taskId}/${resultId}.json`), {
    schemaVersion: "1.0",
    taskResultId: resultId,
    taskId,
    taskPlanId,
    status: "completed",
    changedFiles: ["src/declared.ts"],
    noChangeReason: null,
    verificationResults: [{ verificationId: "VI-review", status: "passed", evidenceType: "static_check", summary: "Declared file changed." }],
    selfRepairSummary: { attempted: false, attemptCount: 0, stopReason: "not_attempted", progressObserved: false },
    failure: null,
    executionContinuity: { taskResultSubmittedAfterVerification: true, agentOwnedLongRunningWork: "none", notes: [] },
    notes: [],
    blockedReasons: [],
    createdAt: now(),
    updatedAt: now(),
  });
  return { deliveryId, phaseId };
}

function scaffoldRepo(root) {
  fs.writeFileSync(projectFile(root, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  fs.mkdirSync(projectFile(root, "src"), { recursive: true });
  fs.writeFileSync(projectFile(root, "src/declared.ts"), "export const declared = 'before';\n");
  git(["init"], root);
  git(["config", "user.name", "Loom Test"], root);
  git(["config", "user.email", "loom-test@example.com"], root);
  git(["add", "package.json", "src/declared.ts"], root);
  git(["commit", "-m", "initial"], root);
  fs.writeFileSync(projectFile(root, "src/declared.ts"), "export const declared = 'after';\n");
  run(["init"], root);
}

function withRoot(prefix, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });

  // ---- Root A: constitution-only -------------------------------------------------
  withRoot("loom-spike-constitution-", (root) => {
    scaffoldRepo(root);
    const { deliveryId, phaseId } = writeReviewReadyState(root, "constitution");

    // Guard: per-delivery AAC genuinely absent, so success can only come from the constitution.
    assert.equal(
      fs.existsSync(projectFile(root, `.loom/deliveries/${deliveryId}/artifacts/architecture/${phaseId}/aac.json`)),
      false,
      "per-delivery AAC must be absent for the constitution case",
    );
    assert.equal(fs.existsSync(projectFile(root, ".loom/contracts/constitution/aac.json")), true);

    const envelope = run(["review", "--delivery-id", deliveryId, "--phase-id", phaseId], root);
    const review = envelope.data;
    const reviewRequest = hydrateRequest(root, readJson(projectFile(root, review.requestPath ?? review.requestRef)));

    // Provenance: review loaded the constitution AAC (distinct id), NOT the taskPlan-referenced
    // per-delivery id. This also proves review has no hidden "loaded id == taskPlan ref" check.
    assert.equal(
      reviewRequest.source.architectureArtifactContractId,
      CONSTITUTION_AAC_ID,
      `review must source the constitution AAC; got ${reviewRequest.source.architectureArtifactContractId}`,
    );

    // Reconciliation actually ran: the review packet was produced from the loaded AAC.
    assert.ok(reviewRequest.reviewPacket, "review packet must be hydrated");
    assert.equal(reviewRequest.reviewPacket.taskPlanId, "taskplan-review-scope");
    assert.ok(Array.isArray(reviewRequest.reviewPacket.workflowClosureRequirements), "AAC-derived closures present");
    assert.ok(Array.isArray(reviewRequest.reviewPacket.tasks) && reviewRequest.reviewPacket.tasks.length === 1);

    // End-to-end: an approving ReviewResult is accepted without locator-uniqueness errors.
    const resultFile = reviewRequest.outputContract.resultFile;
    writeReviewResult(root, reviewRequest, phaseId);
    const accepted = run(["review", "accept", "--delivery-id", deliveryId, "--phase-id", phaseId, "--result-file", resultFile], root).data;
    assert.equal(accepted.accepted, true, JSON.stringify(accepted.issues, null, 2));

    console.log("  [A] constitution-only: review loaded constitution AAC + reconciled + accepted  ✓");
  });

  // ---- Root B: no AAC anywhere (negative control) --------------------------------
  withRoot("loom-spike-noaac-", (root) => {
    scaffoldRepo(root);
    const { deliveryId, phaseId } = writeReviewReadyState(root, "none");
    const envelope = run(["review", "--delivery-id", deliveryId, "--phase-id", phaseId], root, { expectOk: false });
    assert.equal(envelope.ok, false, "review must fail when no AAC exists");
    const message = JSON.stringify(envelope.error ?? envelope);
    assert.ok(
      message.includes("ArchitectureArtifactContract"),
      `expected missing-AAC error, got: ${message}`,
    );
    console.log("  [B] no-aac control: review correctly failed (missing AAC)                       ✓");
  });

  // ---- Root C: per-delivery-only (fallback intact) -------------------------------
  withRoot("loom-spike-fallback-", (root) => {
    scaffoldRepo(root);
    const { deliveryId, phaseId } = writeReviewReadyState(root, "delivery");
    assert.equal(fs.existsSync(projectFile(root, ".loom/contracts/constitution/aac.json")), false);
    const envelope = run(["review", "--delivery-id", deliveryId, "--phase-id", phaseId], root);
    const reviewRequest = hydrateRequest(root, readJson(projectFile(root, envelope.data.requestPath ?? envelope.data.requestRef)));
    assert.equal(
      reviewRequest.source.architectureArtifactContractId,
      PER_DELIVERY_AAC_ID,
      "fallback must source the per-delivery AAC when no constitution exists",
    );
    console.log("  [C] per-delivery fallback: review loaded per-delivery AAC (original path intact) ✓");
  });

  console.log("\nSpike PASSED: AAC reads from project-level constitution; per-delivery is a clean fallback; review reconciliation does not depend on locator uniqueness.");
}

function writeReviewResult(root, reviewRequest, phaseId) {
  const resultFile = reviewRequest.outputContract.resultFile;
  writeJson(projectFile(root, resultFile), {
    schemaVersion: "1.0",
    reviewId: reviewRequest.requestId,
    source: {
      requestId: reviewRequest.requestId,
      phaseId,
      taskPlanId: reviewRequest.source.taskPlanId,
      taskPlanRunId: reviewRequest.source.taskPlanRunId,
    },
    decision: "approved",
    findings: [],
    coverageAssessment: {
      mustAcceptance: [{
        acceptanceRef: "AC-review",
        status: "satisfied",
        supportingTaskResults: ["result-review-scope"],
        evidenceStatus: "sufficient",
        notes: ["Constitution-driven review."],
      }],
      summary: { totalMust: 1, satisfied: 1, insufficientEvidence: 0, notSatisfied: 0, notReviewed: 0 },
    },
    limitations: [],
    pendingActions: [],
    nextAction: {
      type: "done",
      reason: "No further phases in this spike.",
      targetNode: "done",
      targetPhaseId: null,
      targetTaskIds: [],
      findingRefs: [],
      userVisibleState: null,
    },
    notes: ["Spike: AAC sourced from project-level constitution."],
    createdAt: now(),
    updatedAt: now(),
  });
}

main();
