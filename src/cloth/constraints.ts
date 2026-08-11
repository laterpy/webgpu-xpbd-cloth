export interface DistanceConstraint {
  a: number;
  b: number;
  rest: number;
  compliance: number;
}

export interface ConstraintSet {
  constraints: DistanceConstraint[];
  colors: Uint32Array;
  colorCount: number;
}

export interface ClothCompliance {
  structural: number;
  shear: number;
  bend: number;
}

export interface CompressionBarrierOptions {
  /** Fraction of a two-hop rest edge that may remain after a sharp fold. */
  minRatio: number;
  compliance: number;
}

function distance(positions: Float32Array, a: number, b: number): number {
  const ai = a * 3;
  const bi = b * 3;
  const dx = positions[bi] - positions[ai];
  const dy = positions[bi + 1] - positions[ai + 1];
  const dz = positions[bi + 2] - positions[ai + 2];
  return Math.hypot(dx, dy, dz);
}

function colorConstraints(constraints: DistanceConstraint[], vertexCount: number): ConstraintSet {
  // Greedy edge coloring. Within one color no two constraints touch the same
  // particle, so every WebGPU invocation can safely write both endpoints.
  const usedByVertex: Array<Set<number>> = Array.from({ length: vertexCount }, () => new Set<number>());
  const colors = new Uint32Array(constraints.length);
  let maxColor = -1;

  for (let i = 0; i < constraints.length; i++) {
    const { a, b } = constraints[i];
    let color = 0;
    while (usedByVertex[a].has(color) || usedByVertex[b].has(color)) color++;
    colors[i] = color;
    usedByVertex[a].add(color);
    usedByVertex[b].add(color);
    maxColor = Math.max(maxColor, color);
  }

  return { constraints, colors, colorCount: maxColor + 1 };
}

export function buildGridConstraints(
  positions: Float32Array,
  segmentsX: number,
  segmentsY: number,
  compliance: ClothCompliance,
): ConstraintSet {
  const cols = segmentsX + 1;
  const rows = segmentsY + 1;
  const constraints: DistanceConstraint[] = [];
  const index = (x: number, y: number) => y * cols + x;

  const add = (a: number, b: number, c: number) => {
    constraints.push({ a, b, rest: distance(positions, a, b), compliance: c });
  };

  // Structural: horizontal + vertical nearest neighbors.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < segmentsX; x++) add(index(x, y), index(x + 1, y), compliance.structural);
  }
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x < cols; x++) add(index(x, y), index(x, y + 1), compliance.structural);
  }

  // Shear: both diagonals of each grid cell.
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      add(index(x, y), index(x + 1, y + 1), compliance.shear);
      add(index(x + 1, y), index(x, y + 1), compliance.shear);
    }
  }

  // Bending approximation: second-neighbor distance constraints.
  // This is still XPBD, but cheaper than a dihedral-angle bend constraint.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < segmentsX - 1; x++) add(index(x, y), index(x + 2, y), compliance.bend);
  }
  for (let y = 0; y < segmentsY - 1; y++) {
    for (let x = 0; x < cols; x++) add(index(x, y), index(x, y + 2), compliance.bend);
  }

  return colorConstraints(constraints, cols * rows);
}

/**
 * A unilateral lower bound on two-hop chords. Unlike the regular bend
 * distance constraint, this only acts when a local fold is about to collapse
 * into a needle, so large smooth drapes remain free to form.
 */
export function buildCompressionBarriers(
  positions: Float32Array,
  segmentsX: number,
  segmentsY: number,
  options: CompressionBarrierOptions,
): ConstraintSet {
  const cols = segmentsX + 1;
  const rows = segmentsY + 1;
  const constraints: DistanceConstraint[] = [];
  const index = (x: number, y: number) => y * cols + x;
  const add = (a: number, b: number) => {
    constraints.push({
      a,
      b,
      rest: distance(positions, a, b) * options.minRatio,
      compliance: options.compliance,
    });
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < segmentsX - 1; x++) add(index(x, y), index(x + 2, y));
  }
  for (let y = 0; y < segmentsY - 1; y++) {
    for (let x = 0; x < cols; x++) add(index(x, y), index(x, y + 2));
  }

  return colorConstraints(constraints, cols * rows);
}

export function assertValidColoring(set: ConstraintSet): void {
  for (let color = 0; color < set.colorCount; color++) {
    const touched = new Set<number>();
    for (let i = 0; i < set.constraints.length; i++) {
      if (set.colors[i] !== color) continue;
      const { a, b } = set.constraints[i];
      if (touched.has(a) || touched.has(b)) {
        throw new Error(`Constraint coloring conflict in color ${color}, constraint ${i}`);
      }
      touched.add(a);
      touched.add(b);
    }
  }
}
