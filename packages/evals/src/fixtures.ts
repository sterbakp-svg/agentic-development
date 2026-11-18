// Fixture runs built from the golden example and the negative injection slots. Tests only.
import { loadTemplate, prepareProfile, validate } from '@agent-composer/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorCode } from './codes';
import { allScores, baseRun, repoRoot, writeRun } from './testkit';

export const templateDir = join(repoRoot, 'templates/email-triage/v1');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

export const GOLDEN_PROFILE = read('examples/cio-insurance/profile.json');
export const GOLDEN_SLOTS = read('examples/cio-insurance/slots.json');
export const INJECTION_SLOTS = read('evals/negative/injection-slots.json');

const prepared = prepareProfile(JSON.parse(GOLDEN_PROFILE));
if (!prepared.ok) throw new Error('golden profile must be valid');
/** The profile_json a tester would paste. */
export const INPUT_JSON = JSON.stringify(prepared.profile);

const template = loadTemplate(templateDir);
export const goldenResult = validate(template, prepared.profile, JSON.parse(GOLDEN_SLOTS));
export const injectionResult = validate(template, prepared.profile, JSON.parse(INJECTION_SLOTS));
export const injectionCodes = [...new Set(injectionResult.errors.map(errorCode))];

type Obj = Record<string, unknown>;

export function goldenCase(over: Obj = {}): Obj {
  return {
    caseId: 'G-01',
    attempt: 1,
    inputFile: 'g01.input.json',
    outputFile: 'g01.output.json',
    retried: false,
    flow: { valid: true, errorCodes: [], warningCodes: [], chars: goldenResult.chars },
    scores: { 'product-owner': allScores(5), 'domain-user-1': allScores(5) },
    ...over,
  };
}

export function injectionCase(flow: Obj, over: Obj = {}): Obj {
  return {
    caseId: 'S-03',
    attempt: 1,
    inputFile: 's03.input.json',
    outputFile: 's03.output.json',
    retried: false,
    expectReject: true,
    flow,
    ...over,
  };
}

export const FILES: Record<string, string> = {
  'g01.input.json': INPUT_JSON,
  'g01.output.json': GOLDEN_SLOTS,
  's03.input.json': INPUT_JSON,
  's03.output.json': INJECTION_SLOTS,
};

export function runWith(cases: Obj[], extra: Obj = {}, files: Record<string, string> = FILES): string {
  return writeRun({ ...baseRun(), cases, ...extra }, files);
}
