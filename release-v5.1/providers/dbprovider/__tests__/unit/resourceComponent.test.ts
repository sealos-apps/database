import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import * as React from 'react';
import type { getDatabaseResourceComponentSpec as Selector } from '@/utils/adapt';

let select: typeof Selector;

before(async () => {
  Object.assign(globalThis, { React });
  ({ getDatabaseResourceComponentSpec: select } = await import('@/utils/adapt'));
});

describe('database resource component selection', () => {
  it('uses DN resources and replicas even when CN comes first', () => {
    const cn = { name: 'cn', replicas: 2, resources: { limits: { cpu: '1' } } };
    const dn = { name: 'dn-0', replicas: 3, resources: { limits: { cpu: '4' } } };
    assert.equal(select('polardbx', [cn, dn] as any), dn);
  });

  it('selects the MySQL component for apecloud-mysql', () => {
    const sidecar = { name: 'other', replicas: 1 };
    const mysql = { name: 'mysql', replicas: 3 };
    assert.equal(select('apecloud-mysql', [sidecar, mysql] as any), mysql);
  });

  it('preserves the legacy first-component fallback and handles no components', () => {
    const legacy = { name: 'legacy', replicas: 2 };
    assert.equal(select('postgresql', [legacy] as any), legacy);
    assert.equal(select('postgresql', []), undefined);
  });
});
