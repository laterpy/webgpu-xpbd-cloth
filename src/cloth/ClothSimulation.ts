// TSL is a shader DSL whose fluent node types change faster than the stable
// Three.js scene API. Runtime calls below follow the official r185 WebGPU/TSL
// patterns; this file intentionally isolates those dynamic node expressions.
// @ts-nocheck
import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  and,
  atomicAdd,
  atomicLoad,
  atomicStore,
  cos,
  float,
  int,
  instanceIndex,
  sin,
  smoothstep,
  storage,
  uint,
  uniform,
  vec3,
} from 'three/tsl';
import { assertValidColoring, buildCompressionBarriers, buildGridConstraints } from './constraints';

export interface ClothOptions {
  width?: number;
  height?: number;
  segmentsX?: number;
  segmentsY?: number;
  solverIterations?: number;
  gravity?: number;
  wind?: number;
}

export class ClothSimulation {
  readonly geometry: THREE.PlaneGeometry;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshPhysicalMaterial;
  readonly width: number;
  readonly height: number;
  readonly segmentsX: number;
  readonly segmentsY: number;
  readonly vertexCount: number;
  readonly constraintCount: number;
  readonly colorCount: number;
  readonly compressionBarrierCount: number;
  readonly compressionBarrierColorCount: number;
  // Keep only a hint of slack between the two clips. Extreme portrait ratios
  // must scale the inset down so the two attachment points never cross.
  readonly pinInset: number;

  solverIterations: number;

  private readonly positionsAttribute: THREE.StorageBufferAttribute;
  private readonly normalsAttribute: THREE.StorageBufferAttribute;
  private readonly initialPositionsAttribute: THREE.StorageBufferAttribute;
  private readonly restPositionsAttribute: THREE.StorageBufferAttribute;
  private readonly velocitiesAttribute: THREE.StorageBufferAttribute;
  private readonly previousPositionsAttribute: THREE.StorageBufferAttribute;
  private readonly inverseMassAttribute: THREE.StorageBufferAttribute;
  private readonly grabBasePositionsAttribute: THREE.StorageBufferAttribute;
  private readonly grabLambdaAttribute: THREE.StorageBufferAttribute;
  private readonly ownedStorageAttributes = new Set<THREE.StorageBufferAttribute>();
  private disposed = false;

  private readonly dtUniform = uniform(1 / 60);
  private readonly timeUniform = uniform(0);
  private readonly gravityUniform = uniform(new THREE.Vector3(0, -7.8, 0));
  private readonly windUniform = uniform(0);
  private readonly airDragUniform = uniform(0.997);
  private readonly velocityDampingUniform = uniform(0.99);
  private readonly maxVelocityUniform = uniform(8);
  private readonly wallZUniform = uniform(-0.70);

  private readonly grabActiveUniform = uniform(0);
  private readonly grabAnchorUniform = uniform(new THREE.Vector3());
  private readonly grabTargetUniform = uniform(new THREE.Vector3());
  private readonly grabAppliedTargetUniform = uniform(new THREE.Vector3());
  private readonly grabRadiusUniform = uniform(0.24);
  private readonly grabComplianceUniform = uniform(7e-5);
  private readonly maxGrabTravelPerStep = 0.10;
  private readonly maxGrabOffset = 2.2;
  private readonly grabStepDelta = new THREE.Vector3();
  private grabSnapshotPending = false;
  private selfCollisionCooldownSeconds = 0;
  private selfCollisionAccumulator = 0;
  private selfCollisionWasRelevant = false;

  private readonly integrateCompute: unknown;
  private readonly velocityCompute: unknown;
  private readonly normalCompute: unknown;
  private readonly enforcePinsCompute: unknown;
  private readonly captureGrabCompute: unknown;
  private readonly grabResetCompute: unknown;
  private readonly grabSolveCompute: unknown;
  private readonly collisionCompute: unknown;
  private readonly selfCollisionClearCompute: unknown;
  private readonly selfCollisionHashCompute: unknown;
  private readonly selfCollisionResolveCompute: unknown;
  private readonly selfCollisionApplyCompute: unknown;
  private readonly resetCompute: unknown;
  private readonly constraintResetComputes: unknown[] = [];
  private readonly constraintSolveComputes: unknown[] = [];
  private readonly compressionBarrierResetComputes: unknown[] = [];
  private readonly compressionBarrierSolveComputes: unknown[] = [];

  private readonly pinnedIndices: number[];

  constructor(texture: THREE.Texture, options: ClothOptions = {}) {
    const ownStorageAttribute = (attribute: THREE.StorageBufferAttribute) => {
      this.ownedStorageAttributes.add(attribute);
      return attribute;
    };

    this.width = options.width ?? 4.8;
    this.height = options.height ?? 3.2;
    this.segmentsX = options.segmentsX ?? 32;
    this.segmentsY = options.segmentsY ?? 22;
    this.solverIterations = options.solverIterations ?? 6;
    this.pinInset = Math.min(0.025, this.width * 0.12);

    this.geometry = new THREE.PlaneGeometry(this.width, this.height, this.segmentsX, this.segmentsY);
    this.vertexCount = (this.segmentsX + 1) * (this.segmentsY + 1);

    const basePosition = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const initial = new Float32Array(basePosition.array as Float32Array);
    const rest = new Float32Array(initial);
    const normals = new Float32Array(this.vertexCount * 3);
    const velocities = new Float32Array(this.vertexCount * 3);
    const previous = new Float32Array(initial);
    const invMass = new Float32Array(this.vertexCount).fill(1);
    const smallestGridSpacing = Math.min(
      this.width / Math.max(1, this.segmentsX),
      this.height / Math.max(1, this.segmentsY),
    );
    const perturbationAmplitude = Math.min(0.0025, smallestGridSpacing * 0.08);

    // A microscopic deterministic out-of-plane perturbation breaks the exact
    // planar symmetry, like real fabric imperfections. Constraint rest lengths
    // are still computed from the perfectly flat rest shape.
    for (let i = 0; i < this.vertexCount; i++) {
      const seed = Math.sin(i * 12.9898) * perturbationAmplitude;
      initial[i * 3 + 2] = seed;
      previous[i * 3 + 2] = seed;
      normals[i * 3 + 2] = 1;
    }

    // Two-corner hanging mode. Row 0 is the top row of PlaneGeometry.
    this.pinnedIndices = [0, this.segmentsX];
    for (const pin of this.pinnedIndices) invMass[pin] = 0;

    this.positionsAttribute = ownStorageAttribute(new THREE.StorageBufferAttribute(initial, 3));
    this.normalsAttribute = ownStorageAttribute(new THREE.StorageBufferAttribute(normals, 3));
    this.initialPositionsAttribute = ownStorageAttribute(
      new THREE.StorageBufferAttribute(new Float32Array(initial), 3),
    );
    this.restPositionsAttribute = ownStorageAttribute(new THREE.StorageBufferAttribute(rest, 3));
    this.velocitiesAttribute = ownStorageAttribute(new THREE.StorageBufferAttribute(velocities, 3));
    this.previousPositionsAttribute = ownStorageAttribute(new THREE.StorageBufferAttribute(previous, 3));
    this.inverseMassAttribute = ownStorageAttribute(new THREE.StorageBufferAttribute(invMass, 1));
    this.grabBasePositionsAttribute = ownStorageAttribute(
      new THREE.StorageBufferAttribute(new Float32Array(initial), 3),
    );
    this.grabLambdaAttribute = ownStorageAttribute(
      new THREE.StorageBufferAttribute(new Float32Array(this.vertexCount * 3), 3),
    );

    // The same GPU storage buffers are also the live render attributes.
    this.geometry.setAttribute('position', this.positionsAttribute);
    this.geometry.setAttribute('normal', this.normalsAttribute);

    const constraintSet = buildGridConstraints(rest, this.segmentsX, this.segmentsY, {
      structural: 2e-7,
      shear: 1.5e-6,
      bend: 4.5e-4,
    });
    assertValidColoring(constraintSet);
    this.constraintCount = constraintSet.constraints.length;
    this.colorCount = constraintSet.colorCount;

    const compressionBarrierSet = buildCompressionBarriers(rest, this.segmentsX, this.segmentsY, {
      minRatio: 0.65,
      compliance: 1e-7,
    });
    assertValidColoring(compressionBarrierSet);
    this.compressionBarrierCount = compressionBarrierSet.constraints.length;
    this.compressionBarrierColorCount = compressionBarrierSet.colorCount;

    const cA = new Uint32Array(this.constraintCount);
    const cB = new Uint32Array(this.constraintCount);
    const cRest = new Float32Array(this.constraintCount);
    const cCompliance = new Float32Array(this.constraintCount);
    const cLambda = new Float32Array(this.constraintCount);

    for (let i = 0; i < this.constraintCount; i++) {
      const c = constraintSet.constraints[i];
      cA[i] = c.a;
      cB[i] = c.b;
      cRest[i] = c.rest;
      cCompliance[i] = c.compliance;
    }

    const aAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(cA, 1));
    const bAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(cB, 1));
    const restAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(cRest, 1));
    const complianceAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(cCompliance, 1));
    const lambdaAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(cLambda, 1));
    const colorAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(constraintSet.colors, 1));

    const bA = new Uint32Array(this.compressionBarrierCount);
    const bB = new Uint32Array(this.compressionBarrierCount);
    const bMinDistance = new Float32Array(this.compressionBarrierCount);
    const bCompliance = new Float32Array(this.compressionBarrierCount);
    const bLambda = new Float32Array(this.compressionBarrierCount);

    for (let i = 0; i < this.compressionBarrierCount; i++) {
      const barrier = compressionBarrierSet.constraints[i];
      bA[i] = barrier.a;
      bB[i] = barrier.b;
      bMinDistance[i] = barrier.rest;
      bCompliance[i] = barrier.compliance;
    }

    const barrierAAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(bA, 1));
    const barrierBAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(bB, 1));
    const barrierMinDistanceAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(bMinDistance, 1));
    const barrierComplianceAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(bCompliance, 1));
    const barrierLambdaAttr = ownStorageAttribute(new THREE.StorageBufferAttribute(bLambda, 1));
    const barrierColorAttr = ownStorageAttribute(
      new THREE.StorageBufferAttribute(compressionBarrierSet.colors, 1),
    );

    const positions = storage(this.positionsAttribute, 'vec3', this.vertexCount);
    const normalsStorage = storage(this.normalsAttribute, 'vec3', this.vertexCount);
    const initialPositions = storage(this.initialPositionsAttribute, 'vec3', this.vertexCount);
    const restPositions = storage(this.restPositionsAttribute, 'vec3', this.vertexCount);
    const velocitiesStorage = storage(this.velocitiesAttribute, 'vec3', this.vertexCount);
    const previousPositions = storage(this.previousPositionsAttribute, 'vec3', this.vertexCount);
    const inverseMass = storage(this.inverseMassAttribute, 'float', this.vertexCount);
    const grabBasePositions = storage(this.grabBasePositionsAttribute, 'vec3', this.vertexCount);
    const grabLambdas = storage(this.grabLambdaAttribute, 'vec3', this.vertexCount);

    const aStorage = storage(aAttr, 'uint', this.constraintCount);
    const bStorage = storage(bAttr, 'uint', this.constraintCount);
    const restStorage = storage(restAttr, 'float', this.constraintCount);
    const complianceStorage = storage(complianceAttr, 'float', this.constraintCount);
    const lambdaStorage = storage(lambdaAttr, 'float', this.constraintCount);
    const colorStorage = storage(colorAttr, 'uint', this.constraintCount);

    const barrierAStorage = storage(barrierAAttr, 'uint', this.compressionBarrierCount);
    const barrierBStorage = storage(barrierBAttr, 'uint', this.compressionBarrierCount);
    const barrierMinDistanceStorage = storage(barrierMinDistanceAttr, 'float', this.compressionBarrierCount);
    const barrierComplianceStorage = storage(barrierComplianceAttr, 'float', this.compressionBarrierCount);
    const barrierLambdaStorage = storage(barrierLambdaAttr, 'float', this.compressionBarrierCount);
    const barrierColorStorage = storage(barrierColorAttr, 'uint', this.compressionBarrierCount);

    this.captureGrabCompute = Fn(() => {
      const i = instanceIndex;
      grabBasePositions.element(i).assign(positions.element(i));
    })().compute(this.vertexCount).setName('Capture Grab Pose');

    this.integrateCompute = Fn(() => {
      const i = instanceIndex;
      const p = positions.element(i);
      const v = velocitiesStorage.element(i);
      const oldP = previousPositions.element(i);
      const w = inverseMass.element(i);

      oldP.assign(p);

      If(w.greaterThan(0), () => {
        // Subtle spatially varying aerodynamic force. The cloth remains still
        // at wind=0 and gets a non-uniform flutter instead of rigid translation.
        const phase = p.x.mul(1.35).add(p.y.mul(0.55)).add(this.timeUniform.mul(1.7));
        const wind = vec3(
          sin(phase.mul(0.83)).mul(this.windUniform).mul(0.22),
          sin(phase.mul(1.17)).mul(this.windUniform).mul(0.05),
          cos(phase).mul(this.windUniform),
        );

        v.mulAssign(this.airDragUniform);
        v.addAssign(this.gravityUniform.add(wind).mul(this.dtUniform));
        p.addAssign(v.mul(this.dtUniform));
      }).Else(() => {
        v.assign(vec3(0));
      });

    })().compute(this.vertexCount).setName('XPBD Predict');

    const createConstraintPass = (activeColor: number, resetLambda: boolean) => Fn(() => {
      const ci = instanceIndex;
      const lambda = lambdaStorage.element(ci);

      If(colorStorage.element(ci).equal(uint(activeColor)), () => {
        if (resetLambda) lambda.assign(0);

        const ai = aStorage.element(ci);
        const bi = bStorage.element(ci);
        const pa = positions.element(ai);
        const pb = positions.element(bi);
        const wa = float(inverseMass.element(ai)).toVar();
        const wb = float(inverseMass.element(bi)).toVar();

        const wSum = wa.add(wb);
        const delta = pb.sub(pa).toVar();
        const len = delta.length().max(1e-6).toVar();
        const direction = delta.div(len);
        const C = len.sub(restStorage.element(ci));
        const alphaTilde = complianceStorage.element(ci).div(this.dtUniform.mul(this.dtUniform));

        If(wSum.add(alphaTilde).greaterThan(1e-9), () => {
          // XPBD: Δλ = (-C - α~λ) / (Σw + α~)
          const deltaLambda = C.negate()
            .sub(alphaTilde.mul(lambda))
            .div(wSum.add(alphaTilde));

          lambda.addAssign(deltaLambda);
          const correction = direction.mul(deltaLambda);
          pa.subAssign(correction.mul(wa));
          pb.addAssign(correction.mul(wb));
        });
      });
    })().compute(this.constraintCount).setName(`XPBD Constraints C${activeColor}${resetLambda ? ' Reset' : ''}`);

    for (let color = 0; color < this.colorCount; color++) {
      this.constraintResetComputes.push(createConstraintPass(color, true));
      this.constraintSolveComputes.push(createConstraintPass(color, false));
    }

    const createCompressionBarrierPass = (activeColor: number, resetLambda: boolean) => Fn(() => {
      const ci = instanceIndex;
      const lambda = barrierLambdaStorage.element(ci);

      If(barrierColorStorage.element(ci).equal(uint(activeColor)), () => {
        if (resetLambda) lambda.assign(0);

        const ai = barrierAStorage.element(ci);
        const bi = barrierBStorage.element(ci);
        const pa = positions.element(ai);
        const pb = positions.element(bi);
        const wa = float(inverseMass.element(ai)).toVar();
        const wb = float(inverseMass.element(bi)).toVar();
        const wSum = wa.add(wb);
        const delta = pb.sub(pa).toVar();
        const len = delta.length().max(1e-6).toVar();
        const C = len.sub(barrierMinDistanceStorage.element(ci));
        const alphaTilde = barrierComplianceStorage.element(ci).div(this.dtUniform.mul(this.dtUniform));

        // This is an inequality XPBD constraint: a two-hop chord may stretch
        // freely, but it cannot collapse below its safety length and form a
        // needle-like local fold.
        If(and(C.lessThan(0), wSum.add(alphaTilde).greaterThan(1e-9)), () => {
          const proposedLambda = lambda.add(
            C.negate().sub(alphaTilde.mul(lambda)).div(wSum.add(alphaTilde)),
          ).max(0);
          const deltaLambda = proposedLambda.sub(lambda);
          lambda.assign(proposedLambda);
          const correction = delta.div(len).mul(deltaLambda);
          pa.subAssign(correction.mul(wa));
          pb.addAssign(correction.mul(wb));
        }).Else(() => {
          lambda.assign(0);
        });
      });
    })().compute(this.compressionBarrierCount).setName(`Fold Barrier C${activeColor}${resetLambda ? ' Reset' : ''}`);

    for (let color = 0; color < this.compressionBarrierColorCount; color++) {
      this.compressionBarrierResetComputes.push(createCompressionBarrierPass(color, true));
      this.compressionBarrierSolveComputes.push(createCompressionBarrierPass(color, false));
    }

    this.enforcePinsCompute = Fn(() => {
      const i = instanceIndex;
      const p = positions.element(i);
      const v = velocitiesStorage.element(i);
      const w = inverseMass.element(i);

      If(w.equal(0), () => {
        const target = restPositions.element(i).toVar();
        // Pull the two clips slightly inward. The top edge has real geometric
        // slack, so gravity can create a visible catenary-like drape instead of
        // an unnaturally taut straight edge.
        If(i.equal(uint(this.pinnedIndices[0])), () => {
          target.x.addAssign(this.pinInset);
        });
        If(i.equal(uint(this.pinnedIndices[1])), () => {
          target.x.subAssign(this.pinInset);
        });
        p.assign(target);
        v.assign(vec3(0));
      });

    })().compute(this.vertexCount).setName('Pins');

    const createGrabPass = (resetLambda: boolean) => Fn(() => {
      const i = instanceIndex;
      const lambda = grabLambdas.element(i);

      // Reset every particle's attachment lambda. Otherwise an old grab can
      // leak impulses into the next interaction outside the current radius.
      if (resetLambda) lambda.assign(vec3(0));

      const p = positions.element(i);
      const w = inverseMass.element(i);
      // Evaluate the radius in material/rest space so a folded layer cannot
      // accidentally pull an unrelated layer that happens to be nearby.
      const restPoint = restPositions.element(i);
      const weight = float(1).sub(smoothstep(
        this.grabRadiusUniform.mul(0.35),
        this.grabRadiusUniform,
        vec3(
          restPoint.x.sub(this.grabAnchorUniform.x),
          restPoint.y.sub(this.grabAnchorUniform.y),
          0,
        ).length(),
      ));

      If(and(this.grabActiveUniform.greaterThan(0.5), w.greaterThan(0)), () => {
        If(weight.greaterThan(1e-3), () => {
          // Copying the live pose at pointer-down means the target is a
          // translation of the current drape, never a snap back to rest.
          const target = grabBasePositions.element(i).add(
            this.grabAppliedTargetUniform.sub(this.grabAnchorUniform),
          );
          const alphaTilde = this.grabComplianceUniform
            .div(weight.max(0.04))
            .div(this.dtUniform.mul(this.dtUniform));
          const deltaLambda = p.sub(target)
            .negate()
            .sub(lambda.mul(alphaTilde))
            .div(w.add(alphaTilde));

          lambda.addAssign(deltaLambda);
          p.addAssign(deltaLambda.mul(w));
        });
      });
    })().compute(this.vertexCount).setName(`Soft Grab${resetLambda ? ' Reset' : ''}`);

    this.grabResetCompute = createGrabPass(true);
    this.grabSolveCompute = createGrabPass(false);

    // GPU spatial hash for a practical cloth-thickness contact pass. The
    // broad phase uses XY cells; every true 3D contact is still inside the
    // same or a neighboring XY cell, then gets an exact 3D distance test.
    const selfCollisionCellSize = 0.16;
    const selfCollisionMargin = this.maxGrabOffset + 0.5;
    const selfCollisionMinX = -this.width / 2 - selfCollisionMargin;
    const selfCollisionMinY = -this.height / 2 - selfCollisionMargin;
    const selfCollisionColumns = Math.ceil((this.width + selfCollisionMargin * 2) / selfCollisionCellSize);
    const selfCollisionRows = Math.ceil((this.height + selfCollisionMargin * 2) / selfCollisionCellSize);
    const selfCollisionCellCount = selfCollisionColumns * selfCollisionRows;
    const selfCollisionCellCapacity = 12;
    const selfCollisionThickness = 0.055;
    const selfCollisionRelaxation = 0.5;
    const selfCollisionMaxCorrection = 0.035;
    const selfCollisionCounts = storage(
      ownStorageAttribute(new THREE.StorageBufferAttribute(new Uint32Array(selfCollisionCellCount), 1)),
      'uint',
      selfCollisionCellCount,
    ).toAtomic();
    const selfCollisionEntries = storage(
      ownStorageAttribute(
        new THREE.StorageBufferAttribute(
          new Uint32Array(selfCollisionCellCount * selfCollisionCellCapacity),
          1,
        ),
      ),
      'uint',
      selfCollisionCellCount * selfCollisionCellCapacity,
    );
    const selfCollisionCorrections = storage(
      ownStorageAttribute(new THREE.StorageBufferAttribute(new Float32Array(this.vertexCount * 3), 3)),
      'vec3',
      this.vertexCount,
    );
    const selfCollisionCellX = (point: unknown) => (point as { x: unknown }).x
      .add(-selfCollisionMinX)
      .div(selfCollisionCellSize)
      .floor()
      .toInt()
      .max(int(0))
      .min(int(selfCollisionColumns - 1))
      .toUint();
    const selfCollisionCellY = (point: unknown) => (point as { y: unknown }).y
      .add(-selfCollisionMinY)
      .div(selfCollisionCellSize)
      .floor()
      .toInt()
      .max(int(0))
      .min(int(selfCollisionRows - 1))
      .toUint();

    this.selfCollisionClearCompute = Fn(() => {
      atomicStore(selfCollisionCounts.element(instanceIndex), uint(0));
    })().compute(selfCollisionCellCount).setName('Self Collision Clear Grid');

    this.selfCollisionHashCompute = Fn(() => {
      const i = instanceIndex;
      const p = positions.element(i);
      const cellX = selfCollisionCellX(p);
      const cellY = selfCollisionCellY(p);
      const cell = cellY.mul(uint(selfCollisionColumns)).add(cellX);
      const slot = atomicAdd(selfCollisionCounts.element(cell), uint(1)).toVar();

      If(slot.lessThan(uint(selfCollisionCellCapacity)), () => {
        selfCollisionEntries.element(cell.mul(uint(selfCollisionCellCapacity)).add(slot)).assign(i);
      });
    })().compute(this.vertexCount).setName('Self Collision Hash');

    this.selfCollisionResolveCompute = Fn(() => {
      const i = instanceIndex;
      const p = positions.element(i);
      const w = inverseMass.element(i);
      const correction = vec3(0).toVar();
      const cellX = selfCollisionCellX(p);
      const cellY = selfCollisionCellY(p);
      const restX = i.mod(uint(this.segmentsX + 1));
      const restY = i.div(uint(this.segmentsX + 1));

      If(w.greaterThan(0), () => {
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            const neighborX = int(cellX).add(int(offsetX)).toVar();
            const neighborY = int(cellY).add(int(offsetY)).toVar();
            const isInsideGrid = neighborX.greaterThanEqual(int(0))
              .and(neighborX.lessThan(int(selfCollisionColumns)))
              .and(neighborY.greaterThanEqual(int(0)))
              .and(neighborY.lessThan(int(selfCollisionRows)));

            If(isInsideGrid, () => {
              const neighborCell = neighborY.toUint().mul(uint(selfCollisionColumns)).add(neighborX.toUint());
              const entriesInCell = atomicLoad(selfCollisionCounts.element(neighborCell))
                .min(uint(selfCollisionCellCapacity))
                .toVar();

              Loop({
                start: uint(0),
                end: uint(selfCollisionCellCapacity),
                type: 'uint',
                condition: '<',
              }, ({ i: slot }) => {
                If(slot.lessThan(entriesInCell), () => {
                  const j = selfCollisionEntries.element(
                    neighborCell.mul(uint(selfCollisionCellCapacity)).add(slot),
                  ).toVar();
                  const neighborRestX = j.mod(uint(this.segmentsX + 1));
                  const neighborRestY = j.div(uint(this.segmentsX + 1));
                  const isSeparateSheet = abs(int(restX).sub(int(neighborRestX))).greaterThan(int(2))
                    .or(abs(int(restY).sub(int(neighborRestY))).greaterThan(int(2)));
                  const q = positions.element(j);
                  const delta = p.sub(q).toVar();
                  const distance = delta.length().toVar();
                  const fallbackPhase = float(i.add(j)).mul(12.9898);
                  const fallbackDirection = vec3(
                    sin(fallbackPhase),
                    cos(fallbackPhase.mul(1.37)),
                    sin(fallbackPhase.mul(0.73)),
                  ).normalize().mul(i.greaterThan(j).select(float(1), float(-1)));
                  const direction = distance.greaterThan(1e-5)
                    .select(delta.div(distance.max(1e-5)), fallbackDirection);

                  If(and(isSeparateSheet, distance.lessThan(selfCollisionThickness)), () => {
                    const otherWeight = inverseMass.element(j);
                    const share = w.div(w.add(otherWeight).max(1e-6));
                    const amount = float(selfCollisionThickness)
                      .sub(distance)
                      .mul(share)
                      .mul(selfCollisionRelaxation);
                    correction.addAssign(direction.mul(amount));
                  });
                });
              });
            });
          }
        }
      });

      // Several nearby contacts can point in different directions. Cap the
      // combined correction so one crowded frame cannot launch a vertex.
      const correctionLength = correction.length();
      selfCollisionCorrections.element(i).assign(
        correction.mul(float(selfCollisionMaxCorrection).div(correctionLength.max(selfCollisionMaxCorrection))),
      );
    })().compute(this.vertexCount).setName('Self Collision Resolve');

    this.selfCollisionApplyCompute = Fn(() => {
      const i = instanceIndex;
      const w = inverseMass.element(i);
      If(w.greaterThan(0), () => {
        positions.element(i).addAssign(selfCollisionCorrections.element(i));
      });
    })().compute(this.vertexCount).setName('Self Collision Apply');

    this.collisionCompute = Fn(() => {
      const i = instanceIndex;
      const p = positions.element(i);
      const w = inverseMass.element(i);
      If(w.greaterThan(0), () => {
        If(p.z.lessThan(this.wallZUniform), () => {
          p.z.assign(this.wallZUniform);
        });
      });
    })().compute(this.vertexCount).setName('Wall Collision');

    this.velocityCompute = Fn(() => {
      const i = instanceIndex;
      const p = positions.element(i);
      const oldP = previousPositions.element(i);
      const v = velocitiesStorage.element(i);
      const w = inverseMass.element(i);

      If(w.greaterThan(0), () => {
        const rawVelocity = p.sub(oldP).div(this.dtUniform).toVar();
        const speed = rawVelocity.length().toVar();
        // Contact and constraint corrections can otherwise turn a single
        // aggressive drag frame into an unbounded rebound on release.
        v.assign(rawVelocity
          .mul(this.maxVelocityUniform.div(speed.max(this.maxVelocityUniform)))
          .mul(this.velocityDampingUniform));
      }).Else(() => {
        v.assign(vec3(0));
      });

    })().compute(this.vertexCount).setName('XPBD Velocity');

    // Four-neighbor normal reconstruction on GPU. PlaneGeometry row order is
    // top-to-bottom, so "up" is y-1 in grid space.
    const left = new Uint32Array(this.vertexCount);
    const right = new Uint32Array(this.vertexCount);
    const up = new Uint32Array(this.vertexCount);
    const down = new Uint32Array(this.vertexCount);
    const cols = this.segmentsX + 1;
    const rows = this.segmentsY + 1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        left[i] = y * cols + Math.max(0, x - 1);
        right[i] = y * cols + Math.min(cols - 1, x + 1);
        up[i] = Math.max(0, y - 1) * cols + x;
        down[i] = Math.min(rows - 1, y + 1) * cols + x;
      }
    }

    const leftStorage = storage(
      ownStorageAttribute(new THREE.StorageBufferAttribute(left, 1)),
      'uint',
      this.vertexCount,
    );
    const rightStorage = storage(
      ownStorageAttribute(new THREE.StorageBufferAttribute(right, 1)),
      'uint',
      this.vertexCount,
    );
    const upStorage = storage(
      ownStorageAttribute(new THREE.StorageBufferAttribute(up, 1)),
      'uint',
      this.vertexCount,
    );
    const downStorage = storage(
      ownStorageAttribute(new THREE.StorageBufferAttribute(down, 1)),
      'uint',
      this.vertexCount,
    );

    this.normalCompute = Fn(() => {
      const i = instanceIndex;
      const pL = positions.element(leftStorage.element(i));
      const pR = positions.element(rightStorage.element(i));
      const pU = positions.element(upStorage.element(i));
      const pD = positions.element(downStorage.element(i));
      const tangentX = pR.sub(pL);
      const tangentY = pU.sub(pD);
      normalsStorage.element(i).assign(tangentX.cross(tangentY).normalize());
    })().compute(this.vertexCount).setName('Cloth Normals');

    this.resetCompute = Fn(() => {
      const i = instanceIndex;
      // Reset to the same subtly perturbed pose used at construction. The
      // separate rest buffer remains perfectly planar for constraint lengths.
      positions.element(i).assign(initialPositions.element(i));
      previousPositions.element(i).assign(initialPositions.element(i));
      velocitiesStorage.element(i).assign(vec3(0));
    })().compute(this.vertexCount).setName('Reset Cloth');

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    // WebGPURenderer converts the classic MeshPhysicalMaterial into its node
    // implementation internally, while preserving the familiar PBR API.
    this.material = new THREE.MeshPhysicalMaterial({
      map: texture,
      color: 0xffffff,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.72,
      sheen: 0.16,
      sheenColor: new THREE.Color(0xfff3df),
      sheenRoughness: 0.88,
      ior: 1.46,
      envMapIntensity: 0.9,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // The simulated sheet has no geometric thickness, so a sharp fold can cast
    // an oversized silhouette onto the nearby wall. Direct lighting still shows
    // the folds without that distracting black matte.
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    this.setGravity(options.gravity ?? 7.8);
    this.setWind(options.wind ?? 0);
  }

  setGravity(magnitude: number): void {
    this.gravityUniform.value.set(0, -Math.max(0, magnitude), 0);
  }

  setWind(strength: number): void {
    this.windUniform.value = Math.max(0, strength);
  }

  setTexture(texture: THREE.Texture): void {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const old = this.material.map;
    this.material.map = texture;
    this.material.needsUpdate = true;
    if (old && old !== texture) old.dispose();
  }

  dispose(renderer?: THREE.WebGPURenderer): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseGrab();

    const computeNodes = new Set<unknown>([
      this.integrateCompute,
      this.velocityCompute,
      this.normalCompute,
      this.enforcePinsCompute,
      this.captureGrabCompute,
      this.grabResetCompute,
      this.grabSolveCompute,
      this.collisionCompute,
      this.selfCollisionClearCompute,
      this.selfCollisionHashCompute,
      this.selfCollisionResolveCompute,
      this.selfCollisionApplyCompute,
      this.resetCompute,
      ...this.constraintResetComputes,
      ...this.constraintSolveComputes,
      ...this.compressionBarrierResetComputes,
      ...this.compressionBarrierSolveComputes,
    ]);
    for (const node of computeNodes) {
      const disposable = node as { dispose?: () => void };
      disposable.dispose?.();
    }

    const map = this.material.map;
    this.material.map = null;
    map?.dispose();
    this.material.dispose();

    // Geometry releases its render relationships first. Every storage buffer
    // is then deleted explicitly because reset compute can allocate position
    // and normal before the geometry has ever participated in a render pass.
    // The Set, idempotent attribute manager and disposed guard prevent repeats.
    this.geometry.dispose();
    const rendererAttributes = (renderer as unknown as {
      _attributes?: { delete: (attribute: THREE.StorageBufferAttribute) => unknown };
    } | undefined)?._attributes;
    for (const attribute of this.ownedStorageAttributes) {
      // Three r185 does not wire StorageBufferAttribute.dispose() to the
      // renderer's compute-only attribute manager. Delete every owned buffer:
      // this is also needed when reset fails before geometry has ever rendered,
      // and Attributes.delete() is idempotent for render-owned buffers.
      rendererAttributes?.delete(attribute);
      attribute.dispose();
    }
    this.ownedStorageAttributes.clear();
  }

  vertexIndexFromLocal(x: number, y: number): number | null {
    if (x < -this.width / 2 || x > this.width / 2 || y < -this.height / 2 || y > this.height / 2) return null;
    const u = (x + this.width / 2) / this.width;
    const vTop = (this.height / 2 - y) / this.height;
    const gx = Math.round(u * this.segmentsX);
    const gy = Math.round(vTop * this.segmentsY);
    return gy * (this.segmentsX + 1) + gx;
  }

  isPinned(index: number): boolean {
    return this.pinnedIndices.includes(index);
  }

  beginGrab(index: number, target: THREE.Vector3): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.vertexCount || this.isPinned(index)) return false;

    this.grabAnchorUniform.value.copy(target);
    this.grabTargetUniform.value.copy(target);
    this.grabAppliedTargetUniform.value.copy(target);
    this.grabActiveUniform.value = 1;
    this.grabSnapshotPending = true;
    this.selfCollisionCooldownSeconds = 0;
    return true;
  }

  moveGrab(target: THREE.Vector3): void {
    if (this.grabActiveUniform.value <= 0.5) return;

    // A two-corner hanging sheet has a finite reachable region. Bounding the
    // requested offset avoids injecting an impossible amount of strain while
    // still leaving a generous interactive drag range.
    this.grabStepDelta.copy(target).sub(this.grabAnchorUniform.value);
    this.grabStepDelta.z = 0;
    if (this.grabStepDelta.lengthSq() > this.maxGrabOffset ** 2) {
      this.grabStepDelta.setLength(this.maxGrabOffset);
    }
    this.grabTargetUniform.value.copy(this.grabAnchorUniform.value).add(this.grabStepDelta);
  }

  releaseGrab(): void {
    const wasActive = this.grabActiveUniform.value > 0.5;
    this.grabActiveUniform.value = 0;
    this.grabSnapshotPending = false;
    if (wasActive) this.selfCollisionCooldownSeconds = 2;
  }

  reset(renderer: THREE.WebGPURenderer): void {
    this.releaseGrab();
    this.selfCollisionCooldownSeconds = 0;
    this.selfCollisionAccumulator = 0;
    this.selfCollisionWasRelevant = false;
    renderer.compute(this.resetCompute);
    renderer.compute(this.enforcePinsCompute);
    renderer.compute(this.normalCompute);
  }

  step(renderer: THREE.WebGPURenderer, dt: number, time: number): void {
    this.dtUniform.value = dt;
    this.timeUniform.value = time;
    const stepRatio = dt / (1 / 60);
    this.airDragUniform.value = Math.pow(0.997, stepRatio);
    this.velocityDampingUniform.value = Math.pow(0.99, stepRatio);

    if (this.grabActiveUniform.value > 0.5) {
      this.grabStepDelta.copy(this.grabTargetUniform.value).sub(this.grabAppliedTargetUniform.value);
      if (this.grabStepDelta.lengthSq() > this.maxGrabTravelPerStep ** 2) {
        this.grabStepDelta.setLength(this.maxGrabTravelPerStep);
      }
      this.grabAppliedTargetUniform.value.add(this.grabStepDelta);
    }

    if (this.grabSnapshotPending && this.grabActiveUniform.value > 0.5) {
      renderer.compute(this.captureGrabCompute);
      this.grabSnapshotPending = false;
    }

    renderer.compute(this.integrateCompute);

    const selfCollisionIsRelevant = this.grabActiveUniform.value > 0.5
      || this.selfCollisionCooldownSeconds > 0
      || this.windUniform.value > 0.2;
    this.selfCollisionCooldownSeconds = Math.max(0, this.selfCollisionCooldownSeconds - dt);
    const selfCollisionInterval = 1 / 30;
    if (selfCollisionIsRelevant) {
      this.selfCollisionAccumulator = this.selfCollisionWasRelevant
        ? this.selfCollisionAccumulator + dt
        : selfCollisionInterval;
    } else {
      this.selfCollisionAccumulator = 0;
    }
    // A time-based 30 Hz contact update gives active and throttled neighbors
    // the same collision cadence even though their cloth steps use different dt.
    const runSelfCollision = selfCollisionIsRelevant
      && this.selfCollisionAccumulator >= selfCollisionInterval - 1e-6;
    if (runSelfCollision) this.selfCollisionAccumulator = Math.max(
      0,
      this.selfCollisionAccumulator - selfCollisionInterval,
    );
    this.selfCollisionWasRelevant = selfCollisionIsRelevant;
    const selfCollisionIteration = Math.max(0, this.solverIterations - 2);

    for (let iteration = 0; iteration < this.solverIterations; iteration++) {
      const passes = iteration === 0 ? this.constraintResetComputes : this.constraintSolveComputes;
      for (const pass of passes) renderer.compute(pass);
      renderer.compute(iteration === 0 ? this.grabResetCompute : this.grabSolveCompute);

      if (iteration === selfCollisionIteration) {
        // The fold guard is only needed while input or wind can create a
        // sharp fold. Solving it twice here is much cheaper than running it
        // in every distance-constraint iteration.
        if (selfCollisionIsRelevant) {
          for (const pass of this.compressionBarrierResetComputes) renderer.compute(pass);
          for (const pass of this.compressionBarrierSolveComputes) renderer.compute(pass);
        }

        if (runSelfCollision) {
          // These are deliberately separate dispatches: atomics only make
          // hash insertion safe; they do not synchronize all GPU workgroups.
          renderer.compute(this.selfCollisionClearCompute);
          renderer.compute(this.selfCollisionHashCompute);
          renderer.compute(this.selfCollisionResolveCompute);
          renderer.compute(this.selfCollisionApplyCompute);
        }
      }

      renderer.compute(this.collisionCompute);
      renderer.compute(this.enforcePinsCompute);
    }

    renderer.compute(this.velocityCompute);
    renderer.compute(this.normalCompute);
  }
}
