import * as THREE from 'three/webgpu';

export interface GameLoopCallbacks {
  onPhysicsStep: (dt: number, time: number) => void;
  onRenderFrame: (frameDt: number, totalTime: number) => void;
  onError?: (error: unknown) => void;
}

export class GameLoop {
  private running = false;
  private readonly fixedDt = 1 / 60;
  private readonly maxSubsteps = 3;
  private previousTime = 0;
  private accumulator = 0;
  private simulationTime = 0;

  constructor(
    private readonly renderer: THREE.WebGPURenderer,
    private readonly callbacks: GameLoopCallbacks,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTime = performance.now() / 1000;
    this.accumulator = 0;

    this.renderer.setAnimationLoop((milliseconds: number) => {
      if (!this.running) return;
      try {
        const now = milliseconds / 1000;
        const frameDt = Math.min(now - this.previousTime, 1 / 20);
        this.previousTime = now;
        this.accumulator += frameDt;

        let steps = 0;
        while (this.accumulator >= this.fixedDt && steps < this.maxSubsteps) {
          this.simulationTime += this.fixedDt;
          this.callbacks.onPhysicsStep(this.fixedDt, this.simulationTime);
          this.accumulator -= this.fixedDt;
          steps++;
        }
        if (steps === this.maxSubsteps) {
          this.accumulator = Math.min(this.accumulator, this.fixedDt);
        }

        this.callbacks.onRenderFrame(frameDt, now);
      } catch (error) {
        console.error('GameLoop encountered an error:', error);
        this.stop();
        this.callbacks.onError?.(error);
      }
    });
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
  }
}
