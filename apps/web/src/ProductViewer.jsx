import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
function release(object) {
  object?.traverse((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material))
        if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}
export default function ProductViewer({ product }) {
  const host = useRef(null),
    actions = useRef({});
  const [status, setStatus] = useState('loading'),
    [error, setError] = useState('');
  useEffect(() => {
    const node = host.current;
    const abort = new AbortController();
    let disposed = false,
      root,
      renderer,
      controls,
      observer;
    setStatus('loading');
    setError('');
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor('#f0eee8');
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      node.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x726c62, 2.5));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(3, 5, 4);
      scene.add(light);
      const fill = new THREE.DirectionalLight(0xffffff, 1.5);
      fill.position.set(-3, 1, -2);
      scene.add(fill);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = false;
      const render = () => {
        if (!disposed) renderer.render(scene, camera);
      };
      controls.addEventListener('change', render);
      const resize = () => {
        const width = Math.max(node.clientWidth, 1),
          height = Math.max(node.clientHeight, 1);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (root) fit();
        render();
      };
      let radius = 1;
      const fit = () => {
        const distance =
          (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) *
          Math.max(1, 1 / camera.aspect) *
          1.2;
        camera.position.set(distance * 0.6, distance * 0.35, distance);
        camera.near = radius / 1000;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = radius * 0.2;
        controls.maxDistance = distance * 5;
        controls.update();
      };
      actions.current = {
        reset: () => {
          fit();
          render();
        },
        zoom: (factor) => {
          const distance = THREE.MathUtils.clamp(
            camera.position.length() * factor,
            controls.minDistance,
            controls.maxDistance,
          );
          camera.position.setLength(distance);
          controls.update();
          render();
        },
        rotate: (angle) => {
          const spherical = new THREE.Spherical().setFromVector3(
            camera.position,
          );
          spherical.theta += angle;
          camera.position.setFromSpherical(spherical);
          controls.update();
          render();
        },
      };
      observer = new ResizeObserver(resize);
      observer.observe(node);
      resize();
      renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        if (!disposed) {
          setStatus('error');
          setError(
            'Se interrumpió la vista 3D. Cerrá el visor y volvé a abrirlo.',
          );
        }
      });
      (async () => {
        const response = await fetch(product.model.url, {
          signal: abort.signal,
          credentials: 'omit',
        });
        if (!response.ok) throw new Error('No se pudo descargar el modelo');
        const buffer = await response.arrayBuffer();
        if (product.model.format === 'stl') {
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          root = new THREE.Group();
          root.add(
            new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({
                color: '#b9b8b0',
                roughness: 0.65,
                metalness: 0,
              }),
            ),
          );
        } else {
          root = (await new GLTFLoader().parseAsync(buffer, '')).scene;
        }
        if (disposed) {
          release(root);
          return;
        }
        const box = new THREE.Box3().setFromObject(root),
          size = box.getSize(new THREE.Vector3());
        if (
          box.isEmpty() ||
          !Number.isFinite(size.length()) ||
          size.length() === 0
        )
          throw new Error('Modelo vacío');
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        radius = size.length() / 2;
        scene.add(root);
        fit();
        render();
        setStatus('ready');
      })().catch((e) => {
        if (!disposed && e.name !== 'AbortError') {
          setStatus('error');
          setError(
            'No se pudo mostrar el modelo 3D. Intentá abrirlo nuevamente o consultanos por esta pieza.',
          );
        }
      });
    } catch {
      setStatus('error');
      setError(
        'Tu navegador no pudo iniciar el visor 3D. Probá con un navegador actualizado; podés seguir viendo la foto del producto.',
      );
    }
    return () => {
      disposed = true;
      abort.abort();
      observer?.disconnect();
      controls?.dispose();
      release(root);
      renderer?.dispose();
      renderer?.forceContextLoss();
      node.replaceChildren();
      actions.current = {};
    };
  }, [product.model.url, product.model.format]);
  return (
    <div className="product-viewer">
      <div
        className="model-stage"
        ref={host}
        role="img"
        aria-label={'Modelo 3D interactivo de ' + product.name}
      />
      {status === 'loading' && <p role="status">Cargando modelo 3D…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status === 'ready' && (
        <>
          <p className="small">
            Arrastrá para girar. Usá la rueda o dos dedos para acercar.
          </p>
          <div className="viewer-controls">
            <button
              className="outline"
              aria-label="Girar modelo a la izquierda"
              onClick={() => actions.current.rotate?.(-Math.PI / 8)}
            >
              Girar izquierda
            </button>
            <button
              className="outline"
              aria-label="Girar modelo a la derecha"
              onClick={() => actions.current.rotate?.(Math.PI / 8)}
            >
              Girar derecha
            </button>
            <button
              className="outline"
              onClick={() => actions.current.zoom?.(0.8)}
            >
              Acercar
            </button>
            <button
              className="outline"
              onClick={() => actions.current.zoom?.(1.25)}
            >
              Alejar
            </button>
            <button
              className="outline"
              onClick={() => actions.current.reset?.()}
            >
              Restablecer vista
            </button>
          </div>
        </>
      )}
      {product.dimensions && (
        <p className="small">
          Medidas de la ficha: {product.dimensions.width} ×{' '}
          {product.dimensions.height} × {product.dimensions.depth} mm.
        </p>
      )}
    </div>
  );
}
