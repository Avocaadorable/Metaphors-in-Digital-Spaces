const sections = [
  "Project Title",
  "Central Idea",
  "Description",
  "Learning Outcomes",
  "Week 1",
  "Week 2",
  "Week 3",
  "Week 4",
  "Week 5"
];

const syllabus = document.querySelector(".syllabus");
const wheel = document.querySelector(".wheel");
const container = document.querySelector("#wheelItems");
const centerPoint = document.querySelector(".wheel__center");
const elements = [];
const contentElements = sections.map((_, index) =>
  document.querySelector(`#content-${index}`)
);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const centerX = 200;
const centerY = 190;
const radius = 146;
const contentRadius = 380;
const stepAngle = 360 / sections.length;
const wrap = (value, length) => ((value % length) + length) % length;

// Fractional positions let the text rings turn continuously through 360°.
let position = 0;
let activeIndex = 0;
let velocity = 0;
const coastDuration = 180;
let snapTarget = 0;
let motion = "idle";
let frameId = null;
let lastFrameTime = 0;
let drag = null;
let suppressClick = false;
let entrancePending = true;
let entranceElapsed = 0;
const entranceDuration = 6000;
const entranceTurns = 2;

sections.forEach((name, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "wheel__item";
  button.id = `section-${index}`;
  button.textContent = name;
  button.style.left = `${centerX}px`;
  button.style.top = `${centerY}px`;
  button.setAttribute("aria-label", `Go to ${name}`);

  const content = contentElements[index];
  if (content) {
    button.setAttribute("aria-controls", `content-${index}`);
    content.style.left = `${centerX}px`;
    content.style.top = `${centerY}px`;
    content.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, textarea, select")) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && content.contains(selection.anchorNode)) return;
      select(index);
    });
  }

  button.addEventListener("click", () => select(index));
  container.append(button);
  elements.push(button);
});

function render() {
  activeIndex = motion === "entrance" ? 0 : wrap(Math.round(position), sections.length);

  elements.forEach((button, index) => {
    // Keep angles continuous: never flip or wrap an individual label mid-drag.
    const angle = (index - position) * stepAngle;
    button.style.transform =
      `rotate(${angle}deg) translateX(${radius}px) translate(-50%, -50%)`;

    const isActive = index === activeIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "true" : "false");

    const content = contentElements[index];
    if (content) {
      content.style.transform =
        `rotate(${angle}deg) translateX(${contentRadius}px) translateY(-50%)`;
      content.classList.toggle("is-active", isActive);
    }
  });
}

function stopMotion() {
  // User interaction also cancels an entrance that is waiting for the font.
  entrancePending = false;
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  motion = "idle";
  velocity = 0;
  syllabus.classList.remove("is-moving");
}

function requestFrame() {
  if (frameId === null) frameId = requestAnimationFrame(animate);
}

function finishMotion() {
  // Rebase by full turns only, which leaves every label visually unchanged.
  position = wrap(snapTarget, sections.length);
  stopMotion();
  render();
}

function snapTo(target) {
  stopMotion();
  snapTarget = target;
  if (reducedMotion.matches) {
    finishMotion();
    return;
  }

  motion = "snap";
  lastFrameTime = performance.now();
  syllabus.classList.add("is-moving");
  requestFrame();
}

function select(index) {
  const half = sections.length / 2;
  const distance = wrap(index - position + half, sections.length) - half;
  snapTo(position + distance);
}

function step(direction) {
  const from = motion === "snap" ? snapTarget : Math.round(position);
  snapTo(from + direction);
}

function startEntrance() {
  if (!entrancePending) return;
  entrancePending = false;
  if (reducedMotion.matches || drag || motion !== "idle") return;

  entranceElapsed = 0;
  position = 0;
  velocity = 0;
  snapTarget = -sections.length * entranceTurns;
  motion = "entrance";
  lastFrameTime = performance.now();
  syllabus.classList.add("is-moving");
  render();
  requestFrame();
}

function animate(now) {
  frameId = null;
  if (motion === "drag") {
    render();
    return;
  }
  if (motion === "idle") return;

  const dt = Math.min(32, Math.max(0, now - lastFrameTime));
  lastFrameTime = now;

  if (motion === "entrance") {
    entranceElapsed = Math.min(entranceDuration, entranceElapsed + dt);
    const progress = entranceElapsed / entranceDuration;
    // Smooth acceleration and deceleration, with zero speed at both ends.
    const eased = progress ** 3 * (10 - 15 * progress + 6 * progress ** 2);
    position = -sections.length * entranceTurns * eased;
    if (progress === 1) {
      finishMotion();
      return;
    }
    render();
    requestFrame();
    return;
  }

  if (motion === "coast") {
    const decay = Math.exp(-dt / coastDuration);
    position += velocity * coastDuration * (1 - decay);
    velocity *= decay;
    if (Math.abs(velocity) < 0.00035) {
      snapTarget = Math.round(position);
      motion = "snap";
    }
  } else {
    // An exact damped spring keeps the snap smooth at different refresh rates.
    const spring = 0.018;
    const offset = position - snapTarget;
    const blend = velocity + spring * offset;
    const decay = Math.exp(-spring * dt);
    position = snapTarget + (offset + blend * dt) * decay;
    velocity = (velocity - spring * blend * dt) * decay;

    if (Math.abs(position - snapTarget) < 0.001 && Math.abs(velocity) < 0.00005) {
      finishMotion();
      return;
    }
  }

  render();
  requestFrame();
}

// Pointer capture keeps dragging smooth even when the hand leaves the wheel.
function pointerAngle(event, center) {
  const x = event.clientX - center.x;
  const y = event.clientY - center.y;
  if (Math.hypot(x, y) < 24) return null;
  return Math.atan2(y, x) * 180 / Math.PI;
}

wheel.addEventListener("pointerdown", (event) => {
  if (drag || !event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  if (event.target.closest(".wheel__center")) return;
  stopMotion();
  resetScroll();

  const bounds = centerPoint.getBoundingClientRect();
  const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  const captureTarget = event.target.closest(".wheel__item") || wheel;
  drag = {
    pointerId: event.pointerId,
    captureTarget,
    center,
    startX: event.clientX,
    startY: event.clientY,
    lastAngle: pointerAngle(event, center),
    lastTime: performance.now(),
    moved: false
  };
  motion = "drag";
  captureTarget.setPointerCapture(event.pointerId);
  syllabus.classList.add("is-moving");
});

wheel.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;

  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) {
    return;
  }
  drag.moved = true;
  syllabus.classList.add("is-dragging");
  event.preventDefault();

  const now = performance.now();
  const angle = pointerAngle(event, drag.center);
  if (angle !== null && drag.lastAngle !== null) {
    // atan2's -180° / +180° boundary is a normal crossing, not a full turn.
    const delta = wrap(angle - drag.lastAngle + 180, 360) - 180;
    const movement = -delta / stepAngle;
    const dt = Math.max(8, now - drag.lastTime);
    position += movement;
    const weight = 1 - Math.exp(-dt / 35);
    velocity += (movement / dt - velocity) * weight;
    velocity = Math.max(-0.012, Math.min(0.012, velocity));
  } else {
    velocity = 0;
  }

  drag.lastAngle = angle;
  drag.lastTime = now;
  requestFrame();
});

function endDrag(event, cancelled = false) {
  if (!drag || (event && event.pointerId !== drag.pointerId)) return;
  const finished = drag;
  drag = null;
  suppressClick = finished.moved;
  syllabus.classList.remove("is-dragging");
  if (finished.captureTarget.hasPointerCapture(finished.pointerId)) {
    finished.captureTarget.releasePointerCapture(finished.pointerId);
  }

  if (cancelled || reducedMotion.matches || !finished.moved ||
      performance.now() - finished.lastTime > 100 || Math.abs(velocity) < 0.0005) {
    snapTo(Math.round(position));
    return;
  }

  motion = "coast";
  lastFrameTime = performance.now();
  requestFrame();
}

wheel.addEventListener("pointerup", (event) => endDrag(event));
wheel.addEventListener("pointercancel", (event) => endDrag(event, true));
wheel.addEventListener("lostpointercapture", (event) => endDrag(event, true));
window.addEventListener("blur", () => endDrag(null, true));
window.addEventListener("resize", () => endDrag(null, true));

// A completed drag must not trigger the button that the drag started on.
wheel.addEventListener("click", (event) => {
  if (event.target.closest(".wheel__center")) return;
  if (!suppressClick || event.detail === 0) return;
  suppressClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

// Scroll over the wheel or text, vertically or horizontally.
let scrollDistance = 0;
let scrollDirection = 0;
let scrollAdvanced = false;
let scrollEndTimer;

function resetScroll() {
  clearTimeout(scrollEndTimer);
  scrollDistance = 0;
  scrollDirection = 0;
  scrollAdvanced = false;
}

syllabus.addEventListener("wheel", (event) => {
  if (event.ctrlKey || drag) return;
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  if (delta === 0) return;
  event.preventDefault();

  const direction = Math.sign(delta);
  if (direction !== scrollDirection) {
    resetScroll();
    scrollDirection = direction;
  }
  clearTimeout(scrollEndTimer);
  scrollEndTimer = setTimeout(resetScroll, 180);
  if (scrollAdvanced) return;

  const unit = event.deltaMode === 1 ? 16 :
    event.deltaMode === 2 ? window.innerHeight : 1;
  scrollDistance += Math.abs(delta) * unit;
  if (scrollDistance >= 36) {
    step(direction);
    scrollAdvanced = true;
  }
}, { passive: false });

wheel.addEventListener("keydown", (event) => {
  if (drag) return;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    step(1);
  }
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    step(-1);
  }
});

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches && !drag) {
    snapTo(motion === "entrance" ? 0 : motion === "snap" ? snapTarget : Math.round(position));
  }
});

render();

// Start once per page visit, after the custom typeface is ready.
(document.fonts?.ready ?? Promise.resolve()).then(startEntrance, startEntrance);
