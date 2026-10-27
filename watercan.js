(() => {
  const can = document.querySelector(".watering-can");
  const button = document.querySelector(".watering-can__button");
  const art = document.querySelector(".watering-can__art");
  const spout = document.querySelector(".watering-can__spout");
  const drops = document.querySelector(".water-drops");
  const flower = document.querySelector(".wheel__center");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pendingDrops = new Set();
  let drag = null;
  let hasMoved = false;
  let suppressClick = false;
  let pourAnimation = null;
  let autoWatering = false;
  let wateringTimer = null;

  function moveTo(x, y) {
    const bounds = can.getBoundingClientRect();
    const marginX = Math.min(8, Math.max(0, (window.innerWidth - bounds.width) / 2));
    const marginY = Math.min(8, Math.max(0, (window.innerHeight - bounds.height) / 2));
    const maxX = Math.max(marginX, window.innerWidth - bounds.width - marginX);
    const maxY = Math.max(marginY, window.innerHeight - bounds.height - marginY);
    can.style.left = `${Math.max(marginX, Math.min(maxX, x))}px`;
    can.style.top = `${Math.max(marginY, Math.min(maxY, y))}px`;
    can.style.right = "auto";
    can.style.bottom = "auto";
    hasMoved = true;
    updateAutoWatering();
  }

  function clearPendingDrops() {
    pendingDrops.forEach(clearTimeout);
    pendingDrops.clear();
  }

  function flowerWateringTarget() {
    if (!flower || !hasMoved || document.hidden) return null;
    const target = flower.getBoundingClientRect();
    if (!target.width || !target.height) return null;
    const bounds = can.getBoundingClientRect();
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const radius = Math.min(target.width, target.height) / 2;

    // Use the stationary can bounds so its pouring tilt cannot toggle watering.
    const nearestX = Math.max(bounds.left + bounds.width * .08,
      Math.min(centerX, bounds.right - bounds.width * .08));
    const nearestY = Math.max(bounds.top + bounds.height * .08,
      Math.min(centerY, bounds.bottom - bounds.height * .08));
    const overFlower = Math.hypot(nearestX - centerX, nearestY - centerY) <= radius &&
      bounds.top + bounds.height / 2 <= centerY + radius * .35;
    const nozzleX = bounds.left + bounds.width * .09;
    const nozzleY = bounds.top + bounds.height * .38;
    const aboveFlower = Math.abs(nozzleX - centerX) <= radius + 18 &&
      nozzleY >= target.top - 100 && nozzleY <= centerY;
    return overFlower || aboveFlower ? target : null;
  }

  function stopAutoWatering() {
    if (wateringTimer !== null) clearTimeout(wateringTimer);
    wateringTimer = null;
    autoWatering = false;
    can.classList.remove("is-watering");
  }

  function waterFlower() {
    wateringTimer = null;
    const target = flowerWateringTarget();
    if (!target) {
      stopAutoWatering();
      return;
    }
    emitDrop(target);
    wateringTimer = setTimeout(waterFlower, reducedMotion.matches ? 650 : 140);
  }

  function updateAutoWatering() {
    if (!flowerWateringTarget()) {
      stopAutoWatering();
      return;
    }
    if (autoWatering) return;
    autoWatering = true;
    clearPendingDrops();
    if (pourAnimation) {
      pourAnimation.cancel();
      pourAnimation = null;
    }
    can.classList.add("is-watering");
    waterFlower();
  }

  function emitDrop(target = null) {
    // Read the nozzle each time, so water follows the can even during a drag.
    const nozzle = spout.getBoundingClientRect();
    const drop = document.createElement("span");
    const size = 17 + Math.random() * 7;
    drop.className = "water-drop";
    drop.textContent = "💧";
    drop.style.fontSize = `${size}px`;
    drop.style.left = `${nozzle.left - size / 2}px`;
    drop.style.top = `${nozzle.top - size / 2}px`;
    drops.append(drop);

    while (drops.childElementCount > 40) {
      const oldest = drops.firstElementChild;
      oldest.getAnimations().forEach((animation) => animation.cancel());
      oldest.remove();
    }

    let animation;
    if (reducedMotion.matches) {
      animation = drop.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], {
        duration: 500,
        fill: "forwards"
      });
    } else {
      // Aim automatic drops onto the flower, following the nozzle during a drag.
      const landingX = target && Math.max(target.left + target.width * .25,
        Math.min(nozzle.left, target.right - target.width * .25));
      const x = target ? landingX - nozzle.left + (Math.random() - .5) * 12 :
        -(35 + Math.random() * 45);
      const y = target ? Math.max(30, target.top + target.height * .65 - nozzle.top) :
        90 + Math.random() * 65;
      animation = drop.animate([
        { transform: "translate3d(0, 0, 0) scale(.55)", opacity: 0, offset: 0 },
        { transform: `translate3d(${x * .18}px, 4px, 0) scale(1)`, opacity: 1, offset: .18 },
        { transform: `translate3d(${x * .55}px, ${y * .3}px, 0) scale(.95)`, opacity: .95, offset: .55 },
        { transform: `translate3d(${x}px, ${y}px, 0) scale(.65)`, opacity: 0, offset: 1 }
      ], { duration: 850 + Math.random() * 250, easing: "linear", fill: "forwards" });
    }
    animation.finished.then(() => drop.remove(), () => drop.remove());
  }

  function pour() {
    if (autoWatering) return;
    clearPendingDrops();
    if (pourAnimation) pourAnimation.cancel();
    if (reducedMotion.matches) {
      emitDrop();
      return;
    }

    pourAnimation = art.animate([
      { transform: "rotate(0deg)", offset: 0 },
      { transform: "rotate(-16deg)", offset: .2 },
      { transform: "rotate(-16deg)", offset: .7 },
      { transform: "rotate(0deg)", offset: 1 }
    ], { duration: 650, easing: "ease-in-out" });
    pourAnimation.finished.catch(() => {});

    emitDrop();
    for (let i = 1; i < 7; i++) {
      const timer = setTimeout(() => {
        pendingDrops.delete(timer);
        emitDrop();
      }, i * 65);
      pendingDrops.add(timer);
    }
  }

  button.addEventListener("pointerdown", (event) => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const bounds = can.getBoundingClientRect();
    suppressClick = false;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: bounds.left,
      top: bounds.top,
      moved: false
    };
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    event.preventDefault();
    drag.moved = true;
    can.classList.add("is-dragging");
    moveTo(drag.left + dx, drag.top + dy);
  });

  function endDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const finished = drag;
    drag = null;
    suppressClick = finished.moved;
    can.classList.remove("is-dragging");
    if (button.hasPointerCapture(finished.pointerId)) {
      button.releasePointerCapture(finished.pointerId);
    }
  }

  button.addEventListener("pointerup", endDrag);
  button.addEventListener("pointercancel", endDrag);
  button.addEventListener("lostpointercapture", endDrag);
  window.addEventListener("blur", () => endDrag());
  window.addEventListener("resize", () => {
    endDrag();
    if (hasMoved) {
      const bounds = can.getBoundingClientRect();
      moveTo(bounds.left, bounds.top);
    }
  });
  document.addEventListener("scroll", updateAutoWatering, { passive: true, capture: true });
  document.addEventListener("visibilitychange", updateAutoWatering);
  window.addEventListener("pagehide", () => {
    stopAutoWatering();
    clearPendingDrops();
    if (pourAnimation) pourAnimation.cancel();
  });
  window.addEventListener("pageshow", updateAutoWatering);

  button.addEventListener("click", (event) => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    suppressClick = false;
    pour();
  });

  button.addEventListener("keydown", (event) => {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction || drag) return;
    event.preventDefault();
    const distance = event.shiftKey ? 40 : 16;
    const bounds = can.getBoundingClientRect();
    moveTo(bounds.left + direction[0] * distance, bounds.top + direction[1] * distance);
  });

  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    clearPendingDrops();
    if (pourAnimation) pourAnimation.cancel();
    for (const drop of [...drops.children]) {
      drop.getAnimations().forEach((animation) => animation.cancel());
      drop.remove();
    }
  });
})();
