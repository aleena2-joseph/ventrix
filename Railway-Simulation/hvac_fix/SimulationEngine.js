    const TelemetryPublisher = require("./publisher/TelemetryPublisher");
    const MonteCarloEngine = require("./montecarlo/MonteCarloEngine");
    const EnvironmentModel = require("./environment/EnvironmentModel");
    const AssetManager = require("./assets/common/AssetManager");
    const HVACAsset = require("./assets/hvac/HVACAsset");
    class SimulationEngine {
        constructor(updateInterval = 1000) {
            
            this.environment = new EnvironmentModel();
            this.assetManager = new AssetManager();
            this.assetManager.registerAsset(
                new HVACAsset("HVAC-001")
            );  
            this.monteCarlo = new MonteCarloEngine();
            this.publisher = new TelemetryPublisher();
            this.updateInterval = updateInterval;
            this.timer = null;
            this.running = false;

            this.tickCount = 0;
            this.startTime = null;
        }

        async start() { 
            if (this.running) {
                console.log("Simulation is already running.");
                return;
            }

            this.running = true;
            await this.publisher.initialize();
            this.tickCount = 0;
            this.startTime = Date.now();

            const initialEnvironment =
                this.monteCarlo.generateEnvironment();
            this.environment.setEnvironment(initialEnvironment);
            
            console.log("====================================");
            console.log(" Railway HVAC Simulation Started");
            console.log("====================================");

            this.scheduleNextTick();
        }

        // Schedule only after the prior async tick has completed. This avoids
        // concurrent physics updates and Kafka publishes when the broker is slow.
        scheduleNextTick() {
            if (!this.running) return;
            this.timer = setTimeout(async () => {
                try {
                    await this.tick();
                } catch (error) {
                    console.error("Simulation tick failed:", error.message);
                } finally {
                    this.scheduleNextTick();
                }
            }, this.updateInterval);
        }

        async tick() {

            this.tickCount++;
            this.environment.update();
            this.environment.evolve();
            const environment = this.environment.getEnvironment();
            for (const asset of this.assetManager.getAssets()) {
                const packet = asset.update(environment);
                await this.publisher.publish(
                this.tickCount,
                packet
            );
        }
    }
        async stop() {
            if (!this.running) {
                return;
            }

            clearTimeout(this.timer);

            this.running = false;
            await this.publisher.shutdown();

            console.log("\n====================================");
            console.log(" Railway HVAC Simulation Stopped");
            console.log("====================================");
        }
    }

    module.exports = SimulationEngine;
