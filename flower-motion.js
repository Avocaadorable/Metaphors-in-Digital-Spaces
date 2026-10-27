// The flower has its own angle, inertia and pointer handling, independent of the text.
(() => {
  const button = document.querySelector(".wheel__center");
  const image = document.querySelector(".wheel__flower");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let angle = 0;
  let velocity = 0;
  let damping = 700;
  let frameId = null;
  let lastFrameTime = 0;
  let drag = null;
  let suppressClick = false;

  function paint() {
    image.style.transform = `rotate(${angle}deg)`;
  }

  function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    velocity = 0;
    button.classList.remove("is-spinning");
  }

  function requestFrame() {
    if (frameId === null) frameId = requestAnimationFrame(animate);
  }

  function animate(now) {
    frameId = null;
    if (drag) {
      paint();
      return;
    }

    const dt = Math.min(32, Math.max(0, now - lastFrameTime));
    lastFrameTime = now;
    const decay = Math.exp(-dt / damping);
    angle += velocity * damping * (1 - decay);
    velocity *= decay;
    if (Math.abs(velocity) < 0.008) {
      stop();
      angle = ((angle % 360) + 360) % 360;
    } else {
      requestFrame();
    }
    paint();
  }

  function spin() {
    if (drag) return;
    stop();
    if (reducedMotion.matches) {
      angle += 60;
      paint();
      return;
    }

    damping = 700;
    velocity = 0.65;
    lastFrameTime = performance.now();
    button.classList.add("is-spinning");
    requestFrame();
  }

  function pointerAngle(event, gesture) {
    const x = event.clientX - gesture.centerX;
    const y = event.clientY - gesture.centerY;
    if (Math.hypot(x, y) < gesture.deadZone) return null;
    return Math.atan2(y, x) * 180 / Math.PI;
  }

  button.addEventListener("pointerdown", (event) => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    event.stopPropagation();
    stop();
    suppressClick = false;
    const bounds = button.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      deadZone: Math.min(bounds.width, bounds.height) * 0.12,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      lastAngle: null,
      moved: false
    };
    drag.lastAngle = pointerAngle(event, drag);
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-dragging");
    button.classList.add("is-spinning");
  });

  button.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return;
    event.preventDefault();
    drag.moved = true;

    const now = performance.now();
    const currentAngle = pointerAngle(event, drag);
    // A swipe starting at the exact center can still turn the flower.
    let delta = (event.clientX - drag.lastX - event.clientY + drag.lastY) * 1.5;
    if (currentAngle !== null && drag.lastAngle !== null) {
      const circularDelta = ((currentAngle - drag.lastAngle + 540) % 360) - 180;
      if (Math.abs(circularDelta) < 90) delta = circularDelta;
    }
    angle += delta;
    const dt = Math.max(8, now - drag.lastTime);
    const weight = 1 - Math.exp(-dt / 35);
    velocity += (delta / dt - velocity) * weight;
    velocity = Math.max(-1.2, Math.min(1.2, velocity));
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastAngle = currentAngle;
    drag.lastTime = now;
    requestFrame();
  });

  function endDrag(event, cancelled = false) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    if (event) event.stopPropagation();
    const finished = drag;
    drag = null;
    suppressClick = finished.moved;
    button.classList.remove("is-dragging");
    if (button.hasPointerCapture(finished.pointerId)) {
      button.releasePointerCapture(finished.pointerId);
    }

    if (cancelled || reducedMotion.matches || !finished.moved ||
        performance.now() - finished.lastTime > 100 || Math.abs(velocity) < 0.01) {
      stop();
      paint();
      return;
    }

    damping = 420;
    lastFrameTime = performance.now();
    requestFrame();
  }

  button.addEventListener("pointerup", (event) => endDrag(event));
  button.addEventListener("pointercancel", (event) => endDrag(event, true));
  button.addEventListener("lostpointercapture", (event) => endDrag(event, true));
  window.addEventListener("blur", () => endDrag(null, true));
  window.addEventListener("resize", () => endDrag(null, true));

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    suppressClick = false;
    spin();
  });
  button.addEventListener("keydown", (event) => event.stopPropagation());

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches && !drag) stop();
  });

  paint();
})();
