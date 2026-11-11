import assert from 'node:assert/strict';
import {
  formatDurationDetailed,
  extractSiteVisitSchedule,
  mapFirebaseDocToLead,
} from '../src/services/firebaseSyncService';

export async function testFirebaseSyncService(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  // 1. formatDurationDetailed tests
  run('formatDurationDetailed: handles 0, null, and undefined as "0s"', () => {
    assert.equal(formatDurationDetailed(0), '0s');
    assert.equal(formatDurationDetailed(undefined), '0s');
    assert.equal(formatDurationDetailed(-5), '0s');
  });

  run('formatDurationDetailed: formats seconds correctly without minutes', () => {
    assert.equal(formatDurationDetailed(45), '45s');
    assert.equal(formatDurationDetailed(12), '12s');
  });

  run('formatDurationDetailed: formats exact minutes correctly', () => {
    assert.equal(formatDurationDetailed(60), '1m');
    assert.equal(formatDurationDetailed(120), '2m');
  });

  run('formatDurationDetailed: formats combined minutes and seconds', () => {
    assert.equal(formatDurationDetailed(165), '2m 45s');
    assert.equal(formatDurationDetailed(65), '1m 5s');
    assert.equal(formatDurationDetailed(305), '5m 5s');
  });

  // 2. extractSiteVisitSchedule tests
  run('extractSiteVisitSchedule: extracts explicit schedule from qaHistory extractedKey', () => {
    const qa = [
      { stepTitle: 'Language Choice', extractedKey: 'Language', extractedValue: 'English' },
      { stepTitle: 'Budget & Area', extractedKey: 'Budget', extractedValue: 'Rs. 75 Lakhs' },
      { stepTitle: 'Site Visit Confirmation', extractedKey: 'Site Visit Schedule', extractedValue: 'Saturday 11:00 AM' },
    ];
    const schedule = extractSiteVisitSchedule(qa, '');
    assert.equal(schedule, 'Saturday 11:00 AM');
  });

  run('extractSiteVisitSchedule: extracts schedule when question contains site visit', () => {
    const qa = [
      { question: 'Can we schedule a site visit this weekend?', answer: 'Sunday at 4 PM works best for me' },
    ];
    const schedule = extractSiteVisitSchedule(qa, '');
    assert.equal(schedule, 'Sunday at 4 PM works best for me');
  });

  run('extractSiteVisitSchedule: falls back to extracting regex match from summary text', () => {
    const summary = 'Customer was interested in Velachery 2BHK. Confirmed site visit Saturday 10:30 AM.';
    const schedule = extractSiteVisitSchedule([], summary);
    assert.ok(schedule.toLowerCase().includes('site visit'), `Expected match, got: ${schedule}`);
  });

  run('extractSiteVisitSchedule: returns friendly fallback when no appointment was agreed', () => {
    const schedule = extractSiteVisitSchedule([], 'Customer asked for pricing brochure on WhatsApp.');
    assert.equal(schedule, 'Not confirmed / Follow up required');
  });

  // 3. mapFirebaseDocToLead tests
  run('mapFirebaseDocToLead: correctly maps raw Firestore doc into Lead schema with defaults', () => {
    const rawData = {
      name: 'Priya Sharma',
      phone: '+919840123456',
      consent: true,
      status: 'Pending',
      budget: 'Rs. 80 Lakhs',
      location: 'Velachery',
      timeline: 'Within 2 months',
      buyerOrInvestor: 'buyer',
    };
    const lead = mapFirebaseDocToLead('doc_lead_123', rawData);

    assert.equal(lead.id, 'doc_lead_123');
    assert.equal(lead.name, 'Priya Sharma');
    assert.equal(lead.phone, '+919840123456');
    assert.equal(lead.consent, true);
    assert.equal(lead.status, 'Pending');
    assert.equal(lead.outcome, 'PENDING');
    assert.equal(lead.budget, 'Rs. 80 Lakhs');
    assert.equal(lead.location, 'Velachery');
    assert.equal(lead.timeline, 'Within 2 months');
    assert.equal(lead.buyerOrInvestor, 'buyer');
    assert.ok(lead.createdAt);
  });

  return results;
}
