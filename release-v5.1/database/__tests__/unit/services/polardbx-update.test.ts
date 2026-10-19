import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';

(globalThis as any).React = React;

let updateV1: typeof import('../../../src/services/backend/apis/update-database').updateDatabase;
let updateV2: typeof import('../../../src/services/backend/v2alpha/update-database').updateDatabase;
let isPolarDBXReplicaScalingDisabledError: typeof import('../../../src/utils/database').isPolarDBXReplicaScalingDisabledError;

test.before(async () => {
  ({ updateDatabase: updateV1 } = await import(
    '../../../src/services/backend/apis/update-database'
  ));
  ({ updateDatabase: updateV2 } = await import(
    '../../../src/services/backend/v2alpha/update-database'
  ));
  ({ isPolarDBXReplicaScalingDisabledError } = await import('../../../src/utils/database'));
});

const component = (name: string, replicas: number, storage: string) => ({
  name,
  componentDefRef: name,
  replicas,
  resources: {
    requests: { cpu: '100m', memory: '100Mi' },
    limits: { cpu: '1000m', memory: '1Gi' }
  },
  volumeClaimTemplates: [
    {
      name: 'data',
      spec: {
        resources: { requests: { storage } }
      }
    }
  ]
});

const cluster = {
  metadata: {
    name: 'test-db',
    uid: 'test-uid',
    creationTimestamp: new Date(),
    labels: {
      'clusterdefinition.kubeblocks.io/name': 'polardbx',
      'clusterversion.kubeblocks.io/name': 'polardbx-v1.0'
    }
  },
  spec: {
    componentSpecs: [
      component('gms', 1, '3Gi'),
      component('dn-0', 3, '1Gi'),
      component('cn', 1, '1Gi'),
      component('cdc', 1, '1Gi')
    ],
    terminationPolicy: 'Delete'
  }
};

const fakeK8s = () => {
  const applied: unknown[][] = [];
  return {
    applied,
    k8s: {
      namespace: 'ns-test',
      k8sCustomObjects: {
        getNamespacedCustomObject: async () => ({ body: cluster })
      },
      applyYamlList: async (...args: unknown[]) => {
        applied.push(args);
        return [];
      }
    } as any
  };
};

const changedReplicaError = (error: unknown) => isPolarDBXReplicaScalingDisabledError(error);

test('v1 update rejects PolarDB-X replica changes before creating an OpsRequest', async () => {
  const { k8s, applied } = fakeK8s();

  await assert.rejects(
    () =>
      updateV1(k8s, {
        params: { databaseName: 'test-db' },
        body: { resource: { replicas: 5 } }
      } as any),
    changedReplicaError
  );
  assert.equal(applied.length, 0);
});

test('v2alpha update rejects PolarDB-X replica changes before creating an OpsRequest', async () => {
  const { k8s, applied } = fakeK8s();

  await assert.rejects(
    () =>
      updateV2(k8s, {
        params: { databaseName: 'test-db' },
        body: { quota: { replicas: 1 } }
      } as any),
    changedReplicaError
  );
  assert.equal(applied.length, 0);
});

test('v1 update treats an omitted PolarDB-X replica count as a no-op', async () => {
  const { k8s, applied } = fakeK8s();

  const result = await updateV1(k8s, {
    params: { databaseName: 'test-db' },
    body: { resource: {} }
  } as any);

  assert.equal(result.message, 'No resource changes detected');
  assert.equal(applied.length, 0);
});

test('v2alpha update treats an omitted PolarDB-X replica count as a no-op', async () => {
  const { k8s, applied } = fakeK8s();

  const result = await updateV2(k8s, {
    params: { databaseName: 'test-db' },
    body: { quota: {} }
  } as any);

  assert.equal(result.message, 'No quota changes detected');
  assert.equal(applied.length, 0);
});
