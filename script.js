// --- Game Configuration ---
const TARGET_RADIUS = 1.5;
const SPAWN_RANGE_X = 15;
const SPAWN_RANGE_Y = 8;
const SPAWN_Z = -25;
const TARGET_COLOR = 0x38bdf8;
const TARGET_HOVER_COLOR = 0xffffff;

// --- State ---
let camera, scene, renderer, controls;
let targets = [];
let raycaster;
let isGameActive = false;
let score = 0;
let clicks = 0;
let hits = 0;
let startTime = 0;
let duration = 10;
let timerId = null;

// --- DOM Elements ---
const canvasContainer = document.getElementById('canvas-container');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const timeDisplay = document.getElementById('time-display');
const scoreDisplay = document.getElementById('score-display');
const liveCpsDisplay = document.getElementById('live-cps-display');
const accuracyDisplay = document.getElementById('accuracy-display');
const modeBtns = document.querySelectorAll('.mode-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScore = document.getElementById('final-score');
const finalAccuracy = document.getElementById('final-accuracy');
const finalCps = document.getElementById('final-cps');

init();
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 10, 50);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 1.6; // Eye level

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasContainer.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // 5. Controls
    // PointerLockControls is now available globally
    controls = new PointerLockControls(camera, document.body);

    // 6. Raycaster (for shooting)
    raycaster = new THREE.Raycaster();

    // 7. Grid Helper (Floor)
    const gridHelper = new THREE.GridHelper(100, 50, 0x1e293b, 0x1e293b);
    scene.add(gridHelper);

    // Event Listeners
    setupEventListeners();

    // Initial Resize
    onWindowResize();
}

function setupEventListeners() {
    // Mode Selection
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering start
            duration = parseInt(btn.dataset.time);
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            timeDisplay.textContent = duration.toFixed(1) + 's';
        });
    });

    // Start Game
    startScreen.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        if (!isGameActive) startGame();
        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
    });

    controls.addEventListener('unlock', () => {
        if (isGameActive) {
            // Game paused logic if needed
        }
    });

    // Shooting
    document.addEventListener('mousedown', onMouseDown);

    // Restart
    restartBtn.addEventListener('click', () => {
        controls.lock();
    });

    // Resize
    window.addEventListener('resize', onWindowResize);
}

function startGame() {
    isGameActive = true;
    score = 0;
    clicks = 0;
    hits = 0;
    startTime = Date.now();

    // Clear existing targets
    targets.forEach(t => scene.remove(t));
    targets = [];

    // Spawn initial target (Single)
    spawnTarget();

    updateHUD();

    // Timer
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        if (!isGameActive) return;

        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, duration - elapsed);

        timeDisplay.textContent = remaining.toFixed(1) + 's';

        // Update CPS
        if (clicks > 0 && elapsed > 0) {
            const currentCps = clicks / elapsed;
            liveCpsDisplay.textContent = currentCps.toFixed(1);
        }

        if (remaining <= 0) {
            endGame();
        }
    }, 100);
}

function endGame() {
    isGameActive = false;
    clearInterval(timerId);
    controls.unlock();

    // Calculate stats
    const accuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 0;
    const cps = (clicks / duration).toFixed(2);

    finalScore.textContent = score;
    finalAccuracy.textContent = accuracy + '%';
    finalCps.textContent = cps;

    resultScreen.classList.remove('hidden');
}

function spawnTarget(lastPosition = null) {
    const geometry = new THREE.SphereGeometry(TARGET_RADIUS, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: TARGET_COLOR,
        emissive: 0x000000,
        specular: 0x111111,
        shininess: 30
    });
    const sphere = new THREE.Mesh(geometry, material);

    let x, y, z;

    if (lastPosition) {
        // Proximity Spawning (within +/- 2 units)
        const offsetRange = 2;
        x = lastPosition.x + (Math.random() - 0.5) * offsetRange * 2;
        y = lastPosition.y + (Math.random() - 0.5) * offsetRange * 2;
        z = SPAWN_Z; // Keep Z constant for now, or vary slightly

        // Clamp to screen bounds (approximate)
        x = Math.max(-SPAWN_RANGE_X, Math.min(SPAWN_RANGE_X, x));
        y = Math.max(1, Math.min(SPAWN_RANGE_Y + 2, y)); // Keep above ground
    } else {
        // Random Position (Initial)
        x = (Math.random() - 0.5) * SPAWN_RANGE_X * 2;
        y = Math.random() * SPAWN_RANGE_Y + 1;
        z = SPAWN_Z;
    }

    sphere.position.set(x, y, z);

    // Add simple animation data (Velocity removed for stationary)
    sphere.userData = {
        // Stationary
    };

    scene.add(sphere);
    targets.push(sphere);
}

function onMouseDown(event) {
    if (!isGameActive || !controls.isLocked) return;
    if (event.button !== 0) return; // Only left click

    clicks++;

    // Raycast from center of screen
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const intersects = raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
        // Hit!
        hits++;
        score += 100; // Arbitrary score

        const hitObject = intersects[0].object;

        // Remove target
        scene.remove(hitObject);
        targets = targets.filter(t => t !== hitObject);

        // Spawn new one immediately near the old one
        spawnTarget(hitObject.position);

    } else {
        // Miss - No penalty
    }

    updateHUD();
}

function updateHUD() {
    scoreDisplay.textContent = score;
    const accuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 100;
    accuracyDisplay.textContent = accuracy + '%';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (isGameActive) {
        // Stationary targets - no animation needed
    }

    renderer.render(scene, camera);
}
