import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { csp, reportingEndpoints } from './httpHeader.ts';

await test('csp', async (t) => {
	await t.test('no type', () => {
		assert.equal(
			csp({
				'frame-ancestors': ["'self'"],
				'report-to': ['default'],
			}),
			"frame-ancestors 'self';report-to default",
		);
	});
});

await test('reportingEndpoints', () => {
	assert.equal(
		reportingEndpoints({
			default: 'http://report.example.com/report',
			report1: 'http://report.example.com/report1',
		}),
		'default="http://report.example.com/report",report1="http://report.example.com/report1"',
	);
});
