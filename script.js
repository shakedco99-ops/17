// משחק תלת מימד - עיגול אוכל עיגולים קטנים
// בעברית, מבוסס Three.js (ES Modules)

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

(function(){
  const container = document.getElementById('container');
  const scoreEl = document.getElementById('scoreValue');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');

  let scene, camera, renderer;
  let player, playerRadius = 6;
  const collectibles = [];
  const particles = [];
  const areaSize = 180;
  let score = 0;
  let running = false;
  let lastSpawn = 0;
  let baseSpeed = 120; // מהירות בסיסית של השחקן (ניתן להגדיל)

  const keyState = {};
  window.addEventListener('keydown', e=> keyState[e.key.toLowerCase()]=true);
  window.addEventListener('keyup', e=> keyState[e.key.toLowerCase()]=false);

  function init(){
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071026, 0.004);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0,80,120);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x071026);
    container.appendChild(renderer.domElement);

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444b6e, 0.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100,180,100);
    scene.add(dir);

    // ground
    const gmat = new THREE.MeshStandardMaterial({color:0x071026, roughness:0.9, metalness:0.0});
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(areaSize*3, areaSize*3), gmat);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = -10;
    scene.add(ground);

    // subtle grid
    const grid = new THREE.GridHelper(areaSize*2, 40, 0x122033, 0x0b1a2b);
    grid.position.y = -9.99;
    scene.add(grid);

    // player
    const playerMat = new THREE.MeshStandardMaterial({color:0x14b8a6, emissive:0x0b7470, roughness:0.4, metalness:0.2});
    const geom = new THREE.SphereGeometry(playerRadius, 48, 32);
    player = new THREE.Mesh(geom, playerMat);
    player.position.set(0, playerRadius, 0);
    scene.add(player);

    // initial collectibles (smaller sizes so player is visible)
    for(let i=0;i<18;i++) spawnCollectible(2+Math.random()*6);

    window.addEventListener('resize', onResize);
    animate();
  }

  function spawnCollectible(radius=2.5){
    const x = (Math.random()*2-1) * (areaSize - 10);
    const z = (Math.random()*2-1) * (areaSize - 10);
    const geometry = new THREE.SphereGeometry(radius, 24, 16);
    const color = new THREE.Color().setHSL(Math.random()*0.6+0.1,0.8,0.5);
    const material = new THREE.MeshStandardMaterial({color:color, emissive:color.clone().multiplyScalar(0.25), roughness:0.3});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, radius, z);
    mesh.userData = {radius};
    scene.add(mesh);
    collectibles.push(mesh);
  }

  function onResize(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updatePlayer(dt){
    const speed = baseSpeed * (1/(1+playerRadius*0.04));
    let actualSpeed = speed;
    if (keyState['shift']) actualSpeed *= 1.9; // מצב ריצה
    let vx = 0, vz = 0;
    if(keyState['arrowup']||keyState['w']) vz -= 1;
    if(keyState['arrowdown']||keyState['s']) vz += 1;
    if(keyState['arrowleft']||keyState['a']) vx -= 1;
    if(keyState['arrowright']||keyState['d']) vx += 1;
    const len = Math.hypot(vx,vz);
    if(len>0){ vx/=len; vz/=len; }
    player.position.x += vx * actualSpeed * dt;
    player.position.z += vz * actualSpeed * dt;
    // clamp
    player.position.x = Math.max(-areaSize, Math.min(areaSize, player.position.x));
    player.position.z = Math.max(-areaSize, Math.min(areaSize, player.position.z));
  }

  function collect(index){
    const mesh = collectibles[index];
    // create particle pop
    for(let i=0;i<8;i++){
      const pgeom = new THREE.SphereGeometry(0.6,8,6);
      const pm = new THREE.MeshBasicMaterial({color:mesh.material.color.getHex(), transparent:true});
      const p = new THREE.Mesh(pgeom, pm);
      p.position.copy(mesh.position);
      p.userData = {vel:new THREE.Vector3((Math.random()*2-1)*6, Math.random()*4+2, (Math.random()*2-1)*6), life:0.8};
      scene.add(p);
      particles.push(p);
    }

    // increase player size and score
    const gained = Math.ceil(mesh.userData.radius*10);
    score += gained;
    scoreEl.textContent = score;
    playerRadius += mesh.userData.radius*0.2;
    // update player geometry
    const newGeom = new THREE.SphereGeometry(playerRadius,48,32);
    player.geometry.dispose(); player.geometry = newGeom;

    // remove mesh
    scene.remove(mesh);
    collectibles.splice(index,1);
  }

  let prevTime = performance.now();
  function animate(now){
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - prevTime)/1000);
    prevTime = now;

    if(running){
      updatePlayer(dt);

      // spawn periodically
      if(now - lastSpawn > 1200 && collectibles.length < 40){ spawnCollectible(2+Math.random()*6); lastSpawn = now; }

      // rotate collectibles and check collisions
      for(let i=collectibles.length-1;i>=0;i--){
        const c = collectibles[i];
        c.rotation.y += 0.01 + 0.02*(i%3);
        const dx = c.position.x - player.position.x;
        const dz = c.position.z - player.position.z;
        const dist2 = dx*dx + dz*dz;
        const rsum = (c.userData.radius + playerRadius) ;
        if(dist2 < rsum*rsum){ collect(i); }
      }

      // update particles
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.userData.life -= dt;
        p.position.addScaledVector(p.userData.vel, dt);
        p.material.opacity = Math.max(0, p.userData.life/0.8);
        if(p.userData.life <= 0){ scene.remove(p); particles.splice(i,1); }
      }
    }

    // camera follows player smoothly
    const desired = new THREE.Vector3(player.position.x, player.position.y + 40 + playerRadius*2, player.position.z + 90 + playerRadius*2);
    camera.position.lerp(desired, 0.08);
    camera.lookAt(player.position.x, player.position.y, player.position.z);

    renderer.render(scene, camera);
  }

  // UI handlers
  startBtn.addEventListener('click', ()=>{ running = true; startBtn.disabled = true; pauseBtn.disabled = false; });
  pauseBtn.addEventListener('click', ()=>{ running = !running; pauseBtn.textContent = running? 'הפסק' : 'המשך'; });
  resetBtn.addEventListener('click', ()=>{ resetGame(); });

  function resetGame(){
    // clear collectibles and particles
    collectibles.forEach(m=>scene.remove(m)); collectibles.length = 0;
    particles.forEach(p=>scene.remove(p)); particles.length = 0;
    // reset player
    playerRadius = 6; player.geometry.dispose(); player.geometry = new THREE.SphereGeometry(playerRadius,48,32);
    player.position.set(0, playerRadius, 0);
    score = 0; scoreEl.textContent = score;
    // spawn initial
    for(let i=0;i<18;i++) spawnCollectible(2+Math.random()*6);
    running = false; startBtn.disabled = false; pauseBtn.disabled = true; pauseBtn.textContent = 'הפסק';
  }

  // start paused state
  pauseBtn.disabled = true;
  init();

})();
