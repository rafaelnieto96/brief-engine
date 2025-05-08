// ai-background.js
let neurons = [];
let NUM_NEURONS = 40; // Default value that will be adjusted
let ACTIVATION_DISTANCE = 150; // Will be adjusted based on screen size
let MAX_CONNECTIONS = 5; // Can also be adjusted

function calculateDensity() {
    // Reduce neuron density on mobile devices
    const screenArea = window.innerWidth * window.innerHeight;
    const baseDensity = 0.00004; // Adjustable density factor

    // Calculate numbers based on screen size
    NUM_NEURONS = Math.max(10, Math.floor(screenArea * baseDensity));

    // Adjust activation distance for small screens
    ACTIVATION_DISTANCE = Math.min(150, Math.max(80, window.innerWidth / 10));

    // Adjust maximum connections
    MAX_CONNECTIONS = window.innerWidth < 768 ? 3 : 5;
}

function setup() {
    createCanvas(window.innerWidth, window.innerHeight);
    noFill();
    angleMode(DEGREES);

    // Configure density based on screen size
    calculateDensity();

    // Create initial neurons
    for (let i = 0; i < NUM_NEURONS; i++) {
        neurons.push(new Neuron());
    }
}

function drawGradientBackground(c1, c2) {
    noFill();
    for (let y = 0; y < height; y++) {
        let inter = map(y, 0, height, 0, 1);
        let c = lerpColor(c1, c2, inter);
        stroke(c);
        line(0, y, width, y);
    }
    noStroke();
}

function draw() {
    // Lighter color palette with a subtle gradient
    let color1 = color(35, 55, 95);  // Darker blue
    let color2 = color(45, 90, 130); // Softer blue gradient with a hint of teal
    drawGradientBackground(color1, color2);

    // Update and display neurons
    neurons.forEach(neuron => {
        neuron.update();
        neuron.show();
    });

    // Draw active connections
    drawNeuralConnections();

    // Global pulse effect - disable on mobile for better performance
    // Make cursor waves less visible
    if (window.innerWidth > 768) {
        globalPulseEffect();
    }
}

class Neuron {
    constructor() {
        this.pos = createVector(random(width), random(height));
        this.connections = [];
        this.pulse = 0;

        // Adjust size for small devices
        const baseSize = window.innerWidth < 768 ? 6 : 8;
        this.targetSize = random(baseSize, baseSize * 1.8);

        // Blue to teal color palette
        this.hue = random(180, 205);
    }

    update() {
        // Slower movement on mobile devices for better performance
        const moveSpeed = window.innerWidth < 768 ? 0.2 : 0.3;
        this.pos.add(createVector(random(-moveSpeed, moveSpeed), random(-moveSpeed, moveSpeed)));
        this.pos.x = constrain(this.pos.x, 0, width);
        this.pos.y = constrain(this.pos.y, 0, height);

        // Mouse interaction
        let mouseDist = dist(mouseX, mouseY, this.pos.x, this.pos.y);
        if (mouseDist < ACTIVATION_DISTANCE) {
            this.activate();
        }

        // Pulse decay
        this.pulse = lerp(this.pulse, 0, 0.1);
    }

    activate() {
        this.pulse = 1;
        this.hue = (this.hue + 1) % 360;
    }

    show() {
        // Neuron core
        let glowSize = this.targetSize * (1 + this.pulse * 2);
        let alpha = 150 + 105 * sin(frameCount * 0.1);

        // Inner glow effect
        fill(this.hue, 180, 255, alpha * 0.5);
        noStroke();
        ellipse(this.pos.x, this.pos.y, glowSize);

        // Main body
        stroke(this.hue, 180, 255, alpha);
        strokeWeight(window.innerWidth < 768 ? 1.5 : 2);
        fill(25, 55, 85);
        ellipse(this.pos.x, this.pos.y, this.targetSize);
    }
}

function drawNeuralConnections() {
    neurons.forEach((a, i) => {
        // Sort neurons by distance
        let others = neurons.slice(i + 1)
            .map(b => ({ neuron: b, dist: dist(a.pos.x, a.pos.y, b.pos.x, b.pos.y) }))
            .sort((x, y) => x.dist - y.dist)
            .slice(0, MAX_CONNECTIONS);

        others.forEach(({ neuron: b, dist }) => {
            if (dist < ACTIVATION_DISTANCE * 1.8) { // Reduced from 2 to 1.8 for mobile
                let alpha = map(dist, 0, ACTIVATION_DISTANCE * 1.8, 255, 0);
                let lineWidth = map(dist, 0, ACTIVATION_DISTANCE * 1.8,
                    window.innerWidth < 768 ? 2 : 3,
                    window.innerWidth < 768 ? 0.3 : 0.5);

                // Pulse effect on connections - more subtle on mobile
                let pulseSpeed = window.innerWidth < 768 ? 0.03 : 0.05;
                let pulse = (sin(frameCount * pulseSpeed + dist * 0.01) + 1) * 0.5;
                alpha *= pulse;

                stroke(a.hue, 180, 255, alpha);
                strokeWeight(lineWidth);
                line(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
            }
        });
    });
}

function globalPulseEffect() {
    // Reducing visibility of cursor waves
    noFill();
    stroke(160, 240, 255, 25); // More teal-ish but still very subtle
    strokeWeight(window.innerWidth < 768 ? 0.8 : 1);
    let pulseSize = (frameCount % 120) * (window.innerWidth < 768 ? 2 : 3);
    ellipse(mouseX, mouseY, pulseSize, pulseSize);
}

function windowResized() {
    resizeCanvas(window.innerWidth, window.innerHeight);

    // Recalculate density and restart neurons
    calculateDensity();

    // Reset neurons with new configuration
    neurons = [];
    for (let i = 0; i < NUM_NEURONS; i++) {
        neurons.push(new Neuron());
    }
} 