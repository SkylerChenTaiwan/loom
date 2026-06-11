#!/usr/bin/env node

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const cli = path.join(repoRoot, "dist", "cli.js");

function run(args, projectRoot) {
  const output = execFileSync(process.execPath, [cli, ...args, "--project-root", projectRoot, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LOOM_AGENT_PROFILE: "codex" },
  });
  const envelope = JSON.parse(output);
  assert.equal(envelope.ok, true, output);
  return envelope.data;
}

function readJson(projectRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function hydrateRequest(projectRoot, request) {
  const hydrated = { ...request };
  for (const [key, value] of Object.entries(request)) {
    if (!key.endsWith("Ref") || typeof value !== "string" || key === "requestRef") continue;
    const targetKey = key.slice(0, -"Ref".length);
    if (targetKey in hydrated) continue;
    hydrated[targetKey] = readJson(projectRoot, value);
  }
  return hydrated;
}

function includes(text, needle, message) {
  assert.ok(String(text).includes(needle), message);
}

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "loom-brainstorm-business-detail-"));
run(["init"], projectRoot);

const started = run([
  "brainstorm",
  "start",
  "--request",
  "Build an internal account operations system. Staff create accounts, review account applications, block invalid operations with clear reasons, update account status, and query existing accounts before operating on them.",
], projectRoot);

const request = hydrateRequest(projectRoot, readJson(projectRoot, started.requestPath ?? started.requestRef));
assert.equal(request.requestType, "brainstorm_session");

assert.ok(
  request.firstClarificationGate.mustPresentBeforeAccept.includes("businessObjectOperationSummary"),
  "Brainstorm must require businessObjectOperationSummary before accept.",
);

const blockRules = request.clarificationConversationProtocol.blockExecutionRules.join("\n");
includes(blockRules, "key business objects, key field sets, supported operations", "concept_grounding must ask for object fields and operations.");
includes(blockRules, "identity fields, input fields, display fields, relationship fields, state fields", "field-set categories must be explicit and generic.");
includes(blockRules, "operation input, preconditions, validation rules, blocking conditions, blocking reasons", "operation rule details must be explicit.");
includes(blockRules, "Do not present only noun definitions", "concept grounding must not degrade to noun glossary.");

const conceptRule = request.clarificationConversationProtocol.blockConfirmationRules.concept_grounding;
includes(conceptRule, "key field sets", "concept confirmation must include field sets.");
includes(conceptRule, "operation inputs", "concept confirmation must include operation inputs.");
includes(conceptRule, "visible feedback", "concept confirmation must include visible feedback.");

const semanticContract = request.rules.requirementSemanticGrounding.finalSummaryBusinessDetailContract;
assert.equal(semanticContract.objectOperationContract.owningBlock, "concept_grounding");
assert.ok(
  semanticContract.objectOperationContract.candidateFields.includes("conceptGrounding.phaseConceptGrounding.concepts[].explanation"),
  "object-operation details must map to existing ConceptGrounding explanation fields.",
);
assert.ok(
  semanticContract.objectOperationContract.candidateFields.includes("domainModel.businessFlows[].summary"),
  "object-operation details must map to existing business flow summaries.",
);
assert.ok(
  semanticContract.requiredUserVisibleTopicsWhenApplicable.includes("key field sets per object"),
  "final summary contract must preserve key field sets after concept confirmation.",
);

const candidateRules = request.outputContract.schemaShape.candidateRules.join("\n");
includes(candidateRules, "Store confirmed object-operation details in existing BrainstormCandidate fields", "candidate rules must store details in existing fields.");
includes(candidateRules, "domainModel.businessFlows[].summary should describe object operation flow steps", "businessFlows must carry operation details.");
includes(candidateRules, "conceptGrounding.phaseConceptGrounding.concepts[].explanation should capture high-risk object semantics", "ConceptGrounding must carry object semantics.");

const conceptShape = request.outputContract.schemaShape.conceptGrounding.phaseConceptGrounding.concepts[0].explanation;
includes(conceptShape, "key field meaning", "schema shape must guide field meaning in concept explanation.");
includes(conceptShape, "operation inputs", "schema shape must guide operation inputs in concept explanation.");
includes(conceptShape, "visible feedback", "schema shape must guide visible feedback in concept explanation.");

const contractsSource = readRepo("src/core/operations/contracts.ts");
includes(contractsSource, "objectOperationDetailRules", "AAC requirement transfer must include objectOperationDetailRules.");
includes(contractsSource, "Represent business objects as entities or reference projections", "AAC domain_contract mapping must preserve business objects.");
includes(contractsSource, "Represent object operations as userFlows/stateMachines", "AAC behavior mapping must preserve operations.");

const tasksSource = readRepo("src/core/operations/tasks.ts");
includes(tasksSource, "objectOperationDetailRules", "TaskPlan requirement transfer must include objectOperationDetailRules.");
includes(tasksSource, "taskAssignmentRule", "TaskPlan must assign object-operation details to tasks.");
includes(tasksSource, "field meaning, operation invariant, validation/blocking reason", "TaskExecution concept evidence must cover object-operation detail.");
includes(tasksSource, "verificationResults and conceptEvidence must mention the matching implemented or verified behavior", "TaskResult rules must require concrete behavior evidence.");

console.log("Brainstorm business-detail grounding protocol verification passed.");
