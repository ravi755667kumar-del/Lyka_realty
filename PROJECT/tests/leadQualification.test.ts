import assert from 'node:assert/strict';
import { LeadOutcome } from '../src/types';

/**
 * Determines lead outcome and sales dispatch priority from call transcript / qualification
 */
function evaluateLeadOutcome(params: {
  interested: boolean;
  hasBudgetOrLocation: boolean;
  optOut: boolean;
  requestedHumanCallback: boolean;
}): { outcome: LeadOutcome; salesPriority: string; salesStatus: string } {
  const { interested, hasBudgetOrLocation, optOut, requestedHumanCallback } = params;

  if (optOut) {
    return {
      outcome: 'OPT-OUT',
      salesPriority: 'NONE',
      salesStatus: 'DO_NOT_CONTACT',
    };
  }

  if (requestedHumanCallback) {
    return {
      outcome: 'AGENT_CALLBACK',
      salesPriority: 'HIGH',
      salesStatus: 'CALLBACK_REQUESTED',
    };
  }

  if (interested && hasBudgetOrLocation) {
    return {
      outcome: 'HOT',
      salesPriority: 'HIGH',
      salesStatus: 'HOT_LEAD_ACTION_REQUIRED',
    };
  }

  if (interested) {
    return {
      outcome: 'WARM',
      salesPriority: 'MEDIUM',
      salesStatus: 'WARM_NURTURE',
    };
  }

  return {
    outcome: 'COLD',
    salesPriority: 'LOW',
    salesStatus: 'COLD_CLOSED',
  };
}

export async function testLeadQualification(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  run('evaluateLeadOutcome: classifies interested customer with budget as HOT with HIGH sales priority', () => {
    const res = evaluateLeadOutcome({
      interested: true,
      hasBudgetOrLocation: true,
      optOut: false,
      requestedHumanCallback: false,
    });
    assert.equal(res.outcome, 'HOT');
    assert.equal(res.salesPriority, 'HIGH');
    assert.equal(res.salesStatus, 'HOT_LEAD_ACTION_REQUIRED');
  });

  run('evaluateLeadOutcome: classifies interested customer without specific budget as WARM nurture', () => {
    const res = evaluateLeadOutcome({
      interested: true,
      hasBudgetOrLocation: false,
      optOut: false,
      requestedHumanCallback: false,
    });
    assert.equal(res.outcome, 'WARM');
    assert.equal(res.salesPriority, 'MEDIUM');
    assert.equal(res.salesStatus, 'WARM_NURTURE');
  });

  run('evaluateLeadOutcome: classifies uninterested customer as COLD with LOW priority', () => {
    const res = evaluateLeadOutcome({
      interested: false,
      hasBudgetOrLocation: false,
      optOut: false,
      requestedHumanCallback: false,
    });
    assert.equal(res.outcome, 'COLD');
    assert.equal(res.salesPriority, 'LOW');
    assert.equal(res.salesStatus, 'COLD_CLOSED');
  });

  run('evaluateLeadOutcome: customer requesting human agent gets AGENT_CALLBACK with HIGH priority', () => {
    const res = evaluateLeadOutcome({
      interested: true,
      hasBudgetOrLocation: false,
      optOut: false,
      requestedHumanCallback: true,
    });
    assert.equal(res.outcome, 'AGENT_CALLBACK');
    assert.equal(res.salesPriority, 'HIGH');
    assert.equal(res.salesStatus, 'CALLBACK_REQUESTED');
  });

  run('evaluateLeadOutcome: opt-out immediately applies DNC (DO_NOT_CONTACT) with NONE priority', () => {
    const res = evaluateLeadOutcome({
      interested: false,
      hasBudgetOrLocation: false,
      optOut: true,
      requestedHumanCallback: false,
    });
    assert.equal(res.outcome, 'OPT-OUT');
    assert.equal(res.salesPriority, 'NONE');
    assert.equal(res.salesStatus, 'DO_NOT_CONTACT');
  });

  return results;
}
