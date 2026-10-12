"use client";

import { useEffect, useRef } from "react";
import * as THREE from "@/lib/vendor/three.module.js";

type AnimatedCell = {
  mesh: {
    position: { copy: (value: unknown) => void; y: number };
    rotation: { x: number; y: number; z: number; set: (...values: number[]) => void };
    scale: { setScalar: (value: number) => void };
  };
  offset: number;
  speed: number;
  scale: number;
};

export function BloodFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let renderer: {
      dispose: () => void;
      outputColorSpace: unknown;
      render: (scene: unknown, camera: unknown) => void;
      setPixelRatio: (ratio: number) => void;
      setSize: (width: number, height: number, updateStyle: boolean) => void;
    };
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: "low-power",
      });
    } catch {
      canvas.dataset.unavailable = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 7.4);

    const world = new THREE.Group();
    world.rotation.set(-0.15, -0.28, -0.12);
    scene.add(world);

    scene.add(new THREE.AmbientLight(0xffeee9, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffd0c8, 4.8);
    keyLight.position.set(4, 5, 7);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x7f071f, 3.6);
    rimLight.position.set(-4, -2, 2);
    scene.add(rimLight);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.8, -1.3, -0.6),
      new THREE.Vector3(-2.6, 0.7, 0.25),
      new THREE.Vector3(-0.4, -0.35, 0.7),
      new THREE.Vector3(1.8, 0.9, 0.1),
      new THREE.Vector3(4.6, -0.6, -0.8),
    ]);

    const vessel = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.045, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0xff9da6,
        opacity: 0.28,
        transparent: true,
      }),
    );
    world.add(vessel);

    const cellGeometry = new THREE.TorusGeometry(0.34, 0.12, 16, 36);
    cellGeometry.scale(1, 1, 0.42);
    const cellMaterial = new THREE.MeshStandardMaterial({
      color: 0xb61235,
      metalness: 0.05,
      roughness: 0.35,
    });
    const cells: AnimatedCell[] = [];

    for (let index = 0; index < 15; index += 1) {
      const mesh = new THREE.Mesh(cellGeometry, cellMaterial);
      const offset = index / 15;
      const scale = 0.62 + ((index * 17) % 9) / 20;
      mesh.scale.setScalar(scale);
      mesh.rotation.set(index * 0.33, index * 0.51, index * 0.19);
      world.add(mesh);
      cells.push({
        mesh,
        offset,
        scale,
        speed: 0.018 + (index % 4) * 0.004,
      });
    }

    const glowMaterial = new THREE.PointsMaterial({
      color: 0xffc0c6,
      opacity: 0.42,
      size: 0.035,
      transparent: true,
    });
    const glowPositions = new Float32Array(90 * 3);
    for (let index = 0; index < 90; index += 1) {
      const point = curve.getPoint(index / 89);
      glowPositions[index * 3] = point.x + Math.sin(index * 3.1) * 0.32;
      glowPositions[index * 3 + 1] = point.y + Math.cos(index * 2.7) * 0.24;
      glowPositions[index * 3 + 2] = point.z + Math.sin(index * 1.9) * 0.28;
    }
    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(glowPositions, 3),
    );
    world.add(new THREE.Points(glowGeometry, glowMaterial));

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const startedAt = performance.now();

    const placeCells = (elapsed: number) => {
      cells.forEach((cell, index) => {
        const progress = (cell.offset + elapsed * cell.speed) % 1;
        const point = curve.getPoint(progress);
        const tangent = curve.getTangent(progress);
        cell.mesh.position.copy(point);
        cell.mesh.position.y += Math.sin(elapsed * 0.7 + index) * 0.05;
        cell.mesh.rotation.z = Math.atan2(tangent.y, tangent.x);
        cell.mesh.rotation.x += reducedMotion ? 0 : 0.0025 * cell.scale;
        cell.mesh.rotation.y += reducedMotion ? 0 : 0.0035 * cell.scale;
      });
    };

    const render = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      placeCells(elapsed);
      world.rotation.y += (pointerX * 0.16 - world.rotation.y - 0.28) * 0.025;
      world.rotation.x += (-pointerY * 0.09 - world.rotation.x - 0.15) * 0.025;
      renderer.render(scene, camera);
      if (!reducedMotion) frame = window.requestAnimationFrame(render);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      if (reducedMotion) render();
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width - 0.5;
      pointerY = (event.clientY - rect.top) / rect.height - 0.5;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointermove", updatePointer);
    resize();
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", updatePointer);
      cellGeometry.dispose();
      cellMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      vessel.geometry.dispose();
      vessel.material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      aria-hidden="true"
      className="blood-flow-canvas"
      ref={canvasRef}
    />
  );
}
