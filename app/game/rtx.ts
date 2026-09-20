import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { enhanceMaterials, graphicsPixelRatio } from './graphics';

// RTX is an opt-in raster graphics preset, not hardware ray tracing.
// All effects and GPU allocations are created only when it is enabled.
export class RtxGraphics {
  private composer?: EffectComposer;
  private ao?: GTAOPass;
  private fxaa?: ShaderPass;
  private environment?: THREE.WebGLRenderTarget;
  private sky?: THREE.DataTexture;
  private restoreMaterials?: () => void;
  private restoreScene?: () => void;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private sun: THREE.DirectionalLight,
    private hemisphere: THREE.HemisphereLight,
  ) {}

  enable(width: number, height: number) {
    if (!this.renderer.extensions.has('EXT_color_buffer_float')) {
      throw new Error('Enhanced graphics are not supported on this device.');
    }
    const { renderer, scene, sun, hemisphere } = this;
    // Check the actual target format rather than guessing from OS/GPU names.
    // This is the same WebGL 2 path on Apple/Metal and Windows/DirectX drivers.
    const probe = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
    });
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(probe);
      const gl = renderer.getContext();
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE
      ) {
        throw new Error('Floating-point render targets are unavailable.');
      }
    } finally {
      renderer.setRenderTarget(previousTarget);
      probe.dispose();
    }
    const original = {
      background: scene.background,
      fog: scene.fog,
      environment: scene.environment,
      environmentIntensity: scene.environmentIntensity,
      exposure: renderer.toneMappingExposure,
      pixelRatio: renderer.getPixelRatio(),
      sunColor: sun.color.clone(),
      sunIntensity: sun.intensity,
      shadowRadius: sun.shadow.radius,
      shadowBias: sun.shadow.normalBias,
      skyColor: hemisphere.color.clone(),
      groundColor: hemisphere.groundColor.clone(),
      skyIntensity: hemisphere.intensity,
    };
    this.restoreScene = () => {
      scene.background = original.background;
      scene.fog = original.fog;
      scene.environment = original.environment;
      scene.environmentIntensity = original.environmentIntensity;
      renderer.toneMappingExposure = original.exposure;
      renderer.setPixelRatio(original.pixelRatio);
      sun.color.copy(original.sunColor);
      sun.intensity = original.sunIntensity;
      sun.shadow.radius = original.shadowRadius;
      sun.shadow.normalBias = original.shadowBias;
      hemisphere.color.copy(original.skyColor);
      hemisphere.groundColor.copy(original.groundColor);
      hemisphere.intensity = original.skyIntensity;
    };

    const previousShaderError = renderer.debug.onShaderError;
    const previousShaderCheck = renderer.debug.checkShaderErrors;
    let shaderFailed = false;
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (...args) => {
      shaderFailed = true;
      previousShaderError?.(...args);
    };
    try {
      this.sky = this.makeSky();
      scene.background = this.sky;
      scene.fog = original.fog?.clone() ?? null;
      sun.color.copy(original.sunColor);
      sun.intensity = original.sunIntensity * 1.15;
      sun.shadow.radius = 1.75;
      sun.shadow.normalBias = 0.045;
      hemisphere.color.copy(original.skyColor);
      hemisphere.groundColor.copy(original.groundColor);
      hemisphere.intensity = original.skyIntensity * 0.6;
      renderer.toneMappingExposure = 1.0;
      // Capture the surrounding terrain once so polished surfaces reflect the
      // actual course as well as the sky, without six extra renders every frame.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const position = this.camera.position.clone();
      position.y = Math.max(4, position.y);
      try {
        this.environment = pmrem.fromScene(scene, 0.02, 0.1, 260, {
          size: 128,
          position,
        });
      } finally {
        pmrem.dispose();
      }
      scene.environment = this.environment.texture;
      scene.environmentIntensity = 0.38;
      this.restoreMaterials = enhanceMaterials(scene);

      renderer.setPixelRatio(
        graphicsPixelRatio(width, height, window.devicePixelRatio || 1),
      );
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(scene, this.camera));
      this.ao = new GTAOPass(scene, this.camera, 1, 1);
      this.ao.updateGtaoMaterial({
        radius: 0.6,
        thickness: 0.5,
        distanceFallOff: 1,
        samples: 16,
      });
      this.ao.updatePdMaterial({
        radius: 8,
        samples: 16,
        depthPhi: 4,
        normalPhi: 4,
      });
      this.ao.blendIntensity = 0.75;
      this.composer.addPass(this.ao);
      this.composer.addPass(
        new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.4, 1.2),
      );
      this.composer.addPass(new OutputPass());
      this.fxaa = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaa);
      this.resize(width, height);
      // Compile and draw before reporting success; failures restore classic mode.
      this.render();
      if (shaderFailed) throw new Error('Enhanced shaders are unavailable.');
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      renderer.debug.onShaderError = previousShaderError;
      renderer.debug.checkShaderErrors = previousShaderCheck;
    }
  }

  private makeSky() {
    // A small HDR panorama supplies a blue sky, a warm horizon and a bright sun.
    // Generated locally so the standalone game works without network requests.
    const width = 512,
      height = 256;
    const data = new Uint16Array(width * height * 4);
    const background =
      this.scene.background instanceof THREE.Color
        ? this.scene.background
        : new THREE.Color('#8fd9f1');
    const zenith = background.clone().multiplyScalar(0.7);
    const horizon = this.scene.fog?.color.clone() ?? background.clone();
    const ground = this.hemisphere.groundColor.clone(),
      color = new THREE.Color();
    const daylight = Math.max(
      0.08,
      Math.min(1, (background.r + background.g + background.b) / 1.4),
    );
    const sunDirection = this.sun.position
      .clone()
      .sub(this.sun.target.position)
      .normalize();
    const direction = new THREE.Vector3();
    for (let y = 0; y < height; y++) {
      const latitude = (y / (height - 1) - 0.5) * Math.PI;
      const up = Math.sin(latitude);
      for (let x = 0; x < width; x++) {
        const longitude = (x / width - 0.5) * Math.PI * 2;
        direction.set(
          Math.cos(latitude) * Math.cos(longitude),
          up,
          Math.cos(latitude) * Math.sin(longitude),
        );
        color
          .copy(horizon)
          .lerp(up > 0 ? zenith : ground, Math.pow(Math.abs(up), 0.45));
        const alignment = Math.max(0, direction.dot(sunDirection));
        const glow =
          (Math.pow(alignment, 64) * 0.5 + Math.pow(alignment, 2400) * 18) *
          daylight;
        const i = (y * width + x) * 4;
        data[i] = THREE.DataUtils.toHalfFloat(color.r + glow);
        data[i + 1] = THREE.DataUtils.toHalfFloat(color.g + glow * 0.83);
        data[i + 2] = THREE.DataUtils.toHalfFloat(color.b + glow * 0.58);
        data[i + 3] = THREE.DataUtils.toHalfFloat(1);
      }
    }
    const texture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.HalfFloatType,
    );
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  resize(width: number, height: number) {
    if (!this.composer || !this.fxaa || !this.ao) return;
    const ratio = graphicsPixelRatio(
      width,
      height,
      window.devicePixelRatio || 1,
    );
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    // AO at half resolution keeps the effect affordable while moving.
    this.ao.setSize(
      Math.max(1, Math.round((width * ratio) / 2)),
      Math.max(1, Math.round((height * ratio) / 2)),
    );
    this.fxaa.uniforms.resolution.value.set(
      1 / Math.max(1, width * ratio),
      1 / Math.max(1, height * ratio),
    );
  }

  render() {
    this.composer?.render();
  }

  dispose() {
    this.restoreMaterials?.();
    this.restoreScene?.();
    this.restoreMaterials = this.restoreScene = undefined;
    this.composer?.passes.forEach((pass) => pass.dispose());
    // Three r185's GTAOPass.dispose omits these two shader materials.
    this.ao?.gtaoMaterial.dispose();
    this.ao?.blendMaterial.dispose();
    this.composer?.dispose();
    this.environment?.dispose();
    this.sky?.dispose();
    this.composer =
      this.ao =
      this.fxaa =
      this.environment =
      this.sky =
        undefined;
    this.renderer.setRenderTarget(null);
  }
}
