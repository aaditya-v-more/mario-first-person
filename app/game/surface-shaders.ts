import * as THREE from 'three';

// Extend Standard's lighting, shadows and fog instead of replacing its PBR path.
// World-space detail stays continuous across instanced terrain and costs no textures.
export function shadeSurface(
  material: THREE.MeshStandardMaterial,
  terrain = false,
) {
  material.customProgramCacheKey = () => `kingdom-surface-v1-${terrain}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vKingdomPosition;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vec4 kingdomPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        kingdomPosition = instanceMatrix * kingdomPosition;
      #endif
      vKingdomPosition = (modelMatrix * kingdomPosition).xyz;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vKingdomPosition;
    `,
    );
    if (terrain)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
      #include <color_fragment>
      // Broad, band-limited variation avoids shimmering on distant lawns.
      float grassMottle = sin(vKingdomPosition.x * 2.1 + sin(vKingdomPosition.z * 1.7))
        * sin(vKingdomPosition.z * 2.4);
      diffuseColor.rgb *= 0.97 + grassMottle * 0.045;
    `,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      vec3 kingdomNormal = inverseTransformDirection(normal, viewMatrix);
      float upward = smoothstep(-0.6, 0.85, kingdomNormal.y);
      outgoingLight *= mix(0.84, 1.04, upward);
      float kingdomRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
      outgoingLight += diffuseColor.rgb * kingdomRim * 0.075 * upward;
      #include <opaque_fragment>
    `,
    );
  };
}
